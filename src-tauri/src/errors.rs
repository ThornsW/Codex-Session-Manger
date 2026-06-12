use serde::Serialize;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("I/O error at {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("JSON parse error at {path}: {source}")]
    Json {
        path: PathBuf,
        #[source]
        source: serde_json::Error,
    },
    #[error("path is outside known Codex roots: {0}")]
    PathOutsideRoot(PathBuf),
    #[error("Codex appears to be running")]
    CodexRunning,
    #[error("{0}")]
    Message(String),
}

#[derive(Debug, Serialize)]
pub struct SerializableError {
    pub message: String,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        SerializableError {
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}

pub type AppResult<T> = Result<T, AppError>;

pub fn io_error(path: impl Into<PathBuf>, source: std::io::Error) -> AppError {
    AppError::Io {
        path: path.into(),
        source,
    }
}
