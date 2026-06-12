pub fn is_codex_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq Codex.exe"])
            .output();
        match output {
            Ok(output) => String::from_utf8_lossy(&output.stdout)
                .to_ascii_lowercase()
                .contains("codex.exe"),
            Err(_) => false,
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}
