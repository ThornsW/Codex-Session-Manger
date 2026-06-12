use crate::errors::{io_error, AppError, AppResult};
use serde_json::Value;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

pub fn read_jsonl(path: &Path) -> AppResult<Vec<Value>> {
    let file = File::open(path).map_err(|source| io_error(path.to_path_buf(), source))?;
    let reader = BufReader::new(file);
    let mut values = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|source| io_error(path.to_path_buf(), source))?;
        if line.trim().is_empty() {
            continue;
        }
        let value = serde_json::from_str::<Value>(&line).map_err(|source| AppError::Json {
            path: path.to_path_buf(),
            source,
        })?;
        values.push(value);
    }

    Ok(values)
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::prelude::*;

    #[test]
    fn parses_jsonl_rows() {
        let temp = assert_fs::TempDir::new().unwrap();
        let file = temp.child("rows.jsonl");
        file.write_str("{\"a\":1}\n{\"b\":2}\n").unwrap();

        let rows = read_jsonl(file.path()).unwrap();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0]["a"], 1);
        assert_eq!(rows[1]["b"], 2);
    }
}
