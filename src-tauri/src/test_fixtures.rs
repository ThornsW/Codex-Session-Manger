use assert_fs::TempDir;
use std::fs;
use std::path::Path;

pub const SESSION_ONE_ID: &str = "11111111-1111-4111-8111-111111111111";
pub const SESSION_TWO_ID: &str = "22222222-2222-4222-8222-222222222222";

pub fn create_codex_home_fixture() -> TempDir {
    let root = TempDir::new().expect("create temporary Codex home");
    write_fixture_files(root.path());
    root
}

fn write_fixture_files(root: &Path) {
    let session_dir = root.join("sessions").join("2026").join("06").join("12");
    fs::create_dir_all(&session_dir).expect("create fixture sessions directory");

    fs::write(
        root.join("session_index.jsonl"),
        format!(
            "{{\"id\":\"{SESSION_ONE_ID}\",\"thread_name\":\"Fixture cleanup work\",\"updated_at\":\"2026-06-12T01:10:00Z\"}}\n\
             {{\"id\":\"{SESSION_TWO_ID}\",\"thread_name\":\"Archived review\",\"updated_at\":\"2026-06-12T04:10:00Z\"}}\n"
        ),
    )
    .expect("write fixture session index");

    fs::write(
        session_dir.join(format!(
            "rollout-2026-06-12T01-02-03-{SESSION_ONE_ID}.jsonl"
        )),
        format!(
            "{{\"timestamp\":\"2026-06-12T01:02:03Z\",\"type\":\"session_meta\",\"payload\":{{\"id\":\"{SESSION_ONE_ID}\",\"timestamp\":\"2026-06-12T01:02:03Z\",\"cwd\":\"D:\\\\Library\\\\FixtureProject\",\"source\":\"fixture\"}}}}\n\
             {{\"timestamp\":\"2026-06-12T01:03:00Z\",\"type\":\"response_item\",\"payload\":{{\"type\":\"message\",\"content\":[{{\"type\":\"input_text\",\"text\":\"Clean this Codex project history.\"}}]}}}}\n"
        ),
    )
    .expect("write first fixture session");

    fs::write(
        session_dir.join(format!(
            "rollout-2026-06-12T04-05-06-{SESSION_TWO_ID}.jsonl"
        )),
        format!(
            "{{\"timestamp\":\"2026-06-12T04:05:06Z\",\"type\":\"session_meta\",\"payload\":{{\"id\":\"{SESSION_TWO_ID}\",\"timestamp\":\"2026-06-12T04:05:06Z\",\"cwd\":\"D:\\\\Library\\\\ArchiveProject\",\"source\":\"fixture\"}}}}\n\
             {{\"timestamp\":\"2026-06-12T04:06:00Z\",\"type\":\"response_item\",\"payload\":{{\"type\":\"message\",\"content\":[{{\"type\":\"input_text\",\"text\":\"Review archived session history.\"}}]}}}}\n"
        ),
    )
    .expect("write second fixture session");
}
