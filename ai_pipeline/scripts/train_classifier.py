"""
Training Script for Fine-tuned DistilBERT Document Classifier

Run this in Google Colab to train the document classifier on your dataset.

Steps:s
1. Upload dataset.csv to Colab
2. Run this script
3. Download the trained model from models/distilbert_classifier/
4. Place in your local project folder

Dataset format (CSV):
    text,label
    "Document text here",FIR
    "Another document",ID_CARD
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Tuple
from importlib import metadata as importlib_metadata

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    get_linear_schedule_with_warmup
)
from sklearn.model_selection import train_test_split
from tqdm import tqdm


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


RECOMMENDED_COLAB_VERSIONS = {
    "torch": "2.5.1",
    "transformers": "4.46.3",
    "scikit-learn": "1.5.2",
    "pandas": "2.2.2",
    "tqdm": "4.66.5"
}


# Configuration
CONFIG = {
    "model_name": "distilbert-base-uncased",
    "dataset_path": "dataset.csv",  # Upload this to Colab
    "output_dir": "models/distilbert_classifier",
    "num_epochs": 3,
    "batch_size": 16,
    "learning_rate": 2e-5,
    "max_length": 512,
    "test_size": 0.2,
    "random_seed": 42,
    "warmup_steps": 100
}

DOCUMENT_TYPES = ["FIR", "ID_CARD", "CHARGE_SHEET", "POLICE_REPORT"]


def log_runtime_versions():
    """Log installed dependency versions and pin recommendations for Colab."""
    logger.info("\n=== Runtime Package Versions ===")
    for package_name, recommended_version in RECOMMENDED_COLAB_VERSIONS.items():
        try:
            installed_version = importlib_metadata.version(package_name)
            logger.info(
                f"{package_name}: installed={installed_version}, "
                f"recommended={recommended_version}"
            )
        except importlib_metadata.PackageNotFoundError:
            logger.warning(
                f"{package_name}: not installed (recommended={recommended_version})"
            )

    logger.info(
        "\nIf you hit import/version errors in Colab, run:\n"
        "pip install -U torch==2.5.1 transformers==4.46.3 "
        "scikit-learn==1.5.2 pandas==2.2.2 tqdm==4.66.5"
    )


class DocumentDataset(Dataset):
    """Custom Dataset for document classification."""

    def __init__(self, texts: List[str], labels: List[str], 
                 tokenizer, max_length: int = 512):
        """
        Initialize dataset.
        
        Args:
            texts: List of document texts
            labels: List of document type labels
            tokenizer: HuggingFace tokenizer
            max_length: Max token length
        """
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.label2id = {label: idx for idx, label in enumerate(DOCUMENT_TYPES)}

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = self.texts[idx]
        label = self.labels[idx]

        encoding = self.tokenizer(
            text,
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt"
        )

        return {
            "input_ids": encoding["input_ids"].squeeze(),
            "attention_mask": encoding["attention_mask"].squeeze(),
            "labels": torch.tensor(self.label2id[label], dtype=torch.long)
        }


class DocumentClassifierTrainer:
    """Trainer for DistilBERT document classifier."""

    def __init__(self, config: Dict):
        """Initialize trainer with config."""
        self.config = config
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {self.device}")

        self.model = None
        self.tokenizer = None
        self.train_loader = None
        self.val_loader = None

    def load_dataset(self) -> Tuple[List[str], List[str]]:
        """
        Load dataset from CSV file.
        
        Expected format:
            text,label
            "Document text",FIR
            
        Returns:
            Tuple of (texts, labels)
        """
        dataset_path = self.config["dataset_path"]
        
        if not os.path.exists(dataset_path):
            raise FileNotFoundError(
                f"Dataset not found at {dataset_path}\n"
                f"Please upload dataset.csv to Colab with columns: text, label"
            )

        logger.info(f"Loading dataset from {dataset_path}")
        df = pd.read_csv(dataset_path)

        # Validate dataset
        if "text" not in df.columns or "label" not in df.columns:
            raise ValueError("Dataset must have 'text' and 'label' columns")

        # Check valid labels
        invalid_labels = set(df["label"].unique()) - set(DOCUMENT_TYPES)
        if invalid_labels:
            raise ValueError(
                f"Invalid labels found: {invalid_labels}\n"
                f"Valid labels: {DOCUMENT_TYPES}"
            )

        texts = df["text"].tolist()
        labels = df["label"].tolist()

        logger.info(f"Loaded {len(texts)} samples")
        logger.info(f"Label distribution:\n{df['label'].value_counts()}")

        return texts, labels

    def prepare_data(self, texts: List[str], labels: List[str]):
        """
        Prepare dataloaders for training and validation.
        
        Args:
            texts: List of documents
            labels: List of labels
        """
        # Split data
        train_texts, val_texts, train_labels, val_labels = train_test_split(
            texts, labels,
            test_size=self.config["test_size"],
            random_state=self.config["random_seed"],
            stratify=labels
        )

        logger.info(f"Train: {len(train_texts)}, Val: {len(val_texts)}")

        # Create datasets
        train_dataset = DocumentDataset(
            train_texts, train_labels, 
            self.tokenizer,
            self.config["max_length"]
        )
        val_dataset = DocumentDataset(
            val_texts, val_labels,
            self.tokenizer,
            self.config["max_length"]
        )

        # Create dataloaders
        self.train_loader = DataLoader(
            train_dataset,
            batch_size=self.config["batch_size"],
            shuffle=True
        )
        self.val_loader = DataLoader(
            val_dataset,
            batch_size=self.config["batch_size"]
        )

    def load_model(self):
        """Load pre-trained DistilBERT model."""
        logger.info(f"Loading model: {self.config['model_name']}")
        self.tokenizer = AutoTokenizer.from_pretrained(self.config["model_name"])
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.config["model_name"],
            num_labels=len(DOCUMENT_TYPES)
        )
        self.model.to(self.device)
        logger.info("Model loaded successfully")

    def train_epoch(self, optimizer, scheduler):
        """
        Train for one epoch.
        
        Returns:
            Average loss
        """
        self.model.train()
        total_loss = 0

        progress_bar = tqdm(self.train_loader, desc="Training")
        for batch in progress_bar:
            # Move to device
            input_ids = batch["input_ids"].to(self.device)
            attention_mask = batch["attention_mask"].to(self.device)
            labels = batch["labels"].to(self.device)

            # Forward pass
            outputs = self.model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels
            )
            loss = outputs.loss

            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            scheduler.step()

            total_loss += loss.item()
            progress_bar.set_postfix({"loss": loss.item()})

        avg_loss = total_loss / len(self.train_loader)
        return avg_loss

    def validate(self):
        """
        Validate model on validation set.
        
        Returns:
            Dictionary with metrics (accuracy, loss)
        """
        self.model.eval()
        total_loss = 0
        correct = 0
        total = 0

        with torch.no_grad():
            progress_bar = tqdm(self.val_loader, desc="Validating")
            for batch in progress_bar:
                input_ids = batch["input_ids"].to(self.device)
                attention_mask = batch["attention_mask"].to(self.device)
                labels = batch["labels"].to(self.device)

                outputs = self.model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    labels=labels
                )

                total_loss += outputs.loss.item()
                logits = outputs.logits
                predictions = torch.argmax(logits, dim=-1)
                correct += (predictions == labels).sum().item()
                total += labels.size(0)

        avg_loss = total_loss / len(self.val_loader)
        accuracy = correct / total
        return {"accuracy": accuracy, "loss": avg_loss}

    def train(self, texts: List[str], labels: List[str]):
        """
        Full training pipeline.
        
        Args:
            texts: List of documents
            labels: List of labels
        """
        # Prepare data
        self.prepare_data(texts, labels)

        # Setup optimizer
        optimizer = AdamW(
            self.model.parameters(),
            lr=self.config["learning_rate"]
        )

        total_steps = len(self.train_loader) * self.config["num_epochs"]
        scheduler = get_linear_schedule_with_warmup(
            optimizer,
            num_warmup_steps=self.config["warmup_steps"],
            num_training_steps=total_steps
        )

        # Training loop
        best_accuracy = 0
        for epoch in range(self.config["num_epochs"]):
            logger.info(f"\n=== Epoch {epoch + 1}/{self.config['num_epochs']} ===")

            # Train
            train_loss = self.train_epoch(optimizer, scheduler)
            logger.info(f"Train Loss: {train_loss:.4f}")

            # Validate
            metrics = self.validate()
            logger.info(f"Val Loss: {metrics['loss']:.4f}, "
                       f"Val Accuracy: {metrics['accuracy']:.4f}")

            # Save best model
            if metrics["accuracy"] > best_accuracy:
                best_accuracy = metrics["accuracy"]
                self.save_model()
                logger.info(f"✓ Best model saved (accuracy: {best_accuracy:.4f})")

    def save_model(self):
        """Save trained model to disk."""
        output_dir = self.config["output_dir"]
        os.makedirs(output_dir, exist_ok=True)

        logger.info(f"Saving model to {output_dir}")
        self.model.save_pretrained(output_dir)
        self.tokenizer.save_pretrained(output_dir)

        # Save training metadata (separate from HuggingFace config.json)
        training_config_path = os.path.join(output_dir, "training_config.json")
        with open(training_config_path, "w") as f:
            config = {
                "document_types": DOCUMENT_TYPES,
                "model_name": self.config["model_name"],
                "max_length": self.config["max_length"]
            }
            json.dump(config, f, indent=2)

        logger.info("Model saved successfully")


def main():
    """Main training function."""
    logger.info("=== Document Classifier Training ===")
    logger.info(f"Config: {json.dumps(CONFIG, indent=2)}")
    log_runtime_versions()

    # Initialize trainer
    trainer = DocumentClassifierTrainer(CONFIG)

    # Load model
    trainer.load_model()

    # Load dataset
    texts, labels = trainer.load_dataset()

    # Train
    trainer.train(texts, labels)

    logger.info("\n✓ Training completed!")
    logger.info(f"Model saved to: {CONFIG['output_dir']}")
    logger.info("Download the model folder and place in your local project")


if __name__ == "__main__":
    main()
