//! Settings stored in the user's app config folder (config.json). Local only.

use std::{fs, path::PathBuf};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppRule {
    pub id: String,
    pub label: String,
    /// Lowercase executable file name, e.g. "discord.exe".
    pub exe: String,
    /// Opt-in: the overlay may offer to ask this app to close normally (WM_CLOSE).
    pub allow_close: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Config {
    pub rules: Vec<AppRule>,
    /// Shared with the LifeOS web app to sign deep links. 32 random bytes, base64url.
    pub pairing_secret: String,
    pub web_url: String,
}

impl Default for Config {
    fn default() -> Self {
        Self { rules: Vec::new(), pairing_secret: new_secret(), web_url: "http://localhost:3000/focus".into() }
    }
}

pub fn random_bytes<const N: usize>() -> [u8; N] {
    let mut b = [0u8; N];
    getrandom::getrandom(&mut b).expect("OS random number generator unavailable");
    b
}

pub fn new_secret() -> String {
    URL_SAFE_NO_PAD.encode(random_bytes::<32>())
}

pub fn new_id() -> String {
    hex::encode(random_bytes::<8>())
}

/// Only http(s) LifeOS addresses; plain http only for localhost.
pub fn validate_web_url(input: &str) -> Result<String, String> {
    let url = url::Url::parse(input.trim()).map_err(|_| "Enter a full address, like https://lifeos.example.com".to_string())?;
    let local = matches!(url.host_str(), Some("localhost") | Some("127.0.0.1"));
    match url.scheme() {
        "https" => Ok(url.to_string()),
        "http" if local => Ok(url.to_string()),
        _ => Err("Use an https:// address (http:// only for localhost).".into()),
    }
}

pub struct Store {
    path: PathBuf,
}

impl Store {
    pub fn new(dir: PathBuf) -> Self {
        Self { path: dir.join("config.json") }
    }

    pub fn load(&self) -> Config {
        let cfg = fs::read_to_string(&self.path).ok().and_then(|s| serde_json::from_str::<Config>(&s).ok());
        match cfg {
            Some(c) if !c.pairing_secret.is_empty() => c,
            Some(mut c) => {
                c.pairing_secret = new_secret();
                let _ = self.save(&c);
                c
            }
            None => {
                let c = Config::default();
                let _ = self.save(&c);
                c
            }
        }
    }

    pub fn save(&self, cfg: &Config) -> Result<(), String> {
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_vec_pretty(cfg).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &self.path).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secrets_are_43_char_base64url() {
        let s = new_secret();
        assert_eq!(s.len(), 43);
        assert!(s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
        assert_ne!(s, new_secret());
    }

    #[test]
    fn web_url_must_be_https_or_localhost() {
        assert!(validate_web_url("https://lifeos.example.com/focus").is_ok());
        assert!(validate_web_url("http://localhost:3000").is_ok());
        assert!(validate_web_url("http://example.com").is_err());
        assert!(validate_web_url("file:///C:/x").is_err());
        assert!(validate_web_url("javascript:alert(1)").is_err());
    }
}
