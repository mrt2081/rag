import logging
from typing import Dict, Optional, Callable

import yaml
from app.engine.loaders.db import DBLoaderConfig, get_db_documents
from app.engine.loaders.file import FileLoaderConfig, get_file_documents
from app.engine.loaders.web import WebLoaderConfig, get_web_documents

logger = logging.getLogger(__name__)


def load_configs():
    with open("config/loaders.yaml") as f:
        configs = yaml.safe_load(f)
    return configs


def get_documents(fileMetadata: Optional[Callable[[str], Dict]] = None):
    documents = []
    config = load_configs()
    for loader_type, loader_config in config.items():
        logger.info(
            f"Loading documents from loader: {loader_type}, "
            f"config: {loader_config}"
        )
        match loader_type:
            case "file":
                document = get_file_documents(
                    FileLoaderConfig(**loader_config), fileMetadata
                )
            case "web":
                document = get_web_documents(WebLoaderConfig(**loader_config))
            case "db":
                document = get_db_documents(
                    configs=[DBLoaderConfig(**cfg) for cfg in loader_config]
                )
            case _:
                raise ValueError(f"Invalid loader type: {loader_type}")
        documents.extend(document)

    return documents
