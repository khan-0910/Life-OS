//! Verifying signed `lifeos-companion://focus?...` links from the LifeOS web app.
//! Must match packages/domain/src/companion.ts (shared test vector below).

use std::collections::VecDeque;

use hmac::{Hmac, Mac};
use sha2::Sha256;

use crate::guard::MAX_WINDOW_MS;

const MAX_AGE_MS: i64 = 2 * 60 * 1000;
const MAX_SKEW_MS: i64 = 30 * 1000;
const NONCE_MEMORY: usize = 128;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    Start,
    Stop,
}

#[derive(Debug, PartialEq, Eq)]
pub struct Command {
    pub action: Action,
    pub until: i64,
}

#[derive(Default)]
pub struct NonceCache(VecDeque<String>);

impl NonceCache {
    fn check_and_remember(&mut self, nonce: &str) -> bool {
        if self.0.iter().any(|n| n == nonce) {
            return false;
        }
        if self.0.len() >= NONCE_MEMORY {
            self.0.pop_front();
        }
        self.0.push_back(nonce.to_string());
        true
    }
}

pub fn canonical(action: &str, until: i64, iat: i64, nonce: &str) -> String {
    format!("lifeos-companion/v1\n{action}\n{until}\n{iat}\n{nonce}")
}

/// Returns a short, non-sensitive reason on failure (safe to show and log).
pub fn verify(link: &str, secret: &str, now: i64, nonces: &mut NonceCache) -> Result<Command, &'static str> {
    if secret.is_empty() {
        return Err("not paired");
    }
    let url = url::Url::parse(link).map_err(|_| "malformed link")?;
    if url.scheme() != "lifeos-companion" || url.host_str() != Some("focus") {
        return Err("unexpected link");
    }
    let (mut action, mut until, mut iat, mut nonce, mut sig) = (None, None, None, None, None);
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "action" => action = Some(v.into_owned()),
            "until" => until = v.parse::<i64>().ok(),
            "iat" => iat = v.parse::<i64>().ok(),
            "nonce" => nonce = Some(v.into_owned()),
            "sig" => sig = Some(v.into_owned()),
            _ => return Err("unexpected parameter"),
        }
    }
    let (action, until, iat, nonce, sig) = match (action, until, iat, nonce, sig) {
        (Some(a), Some(u), Some(i), Some(n), Some(s)) => (a, u, i, n, s),
        _ => return Err("missing parameter"),
    };
    if nonce.len() < 16 || nonce.len() > 64 || !nonce.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("bad nonce");
    }
    let sig = hex::decode(&sig).map_err(|_| "bad signature")?;
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).map_err(|_| "bad key")?;
    mac.update(canonical(&action, until, iat, &nonce).as_bytes());
    mac.verify_slice(&sig).map_err(|_| "bad signature")?; // constant-time

    if iat < now - MAX_AGE_MS || iat > now + MAX_SKEW_MS {
        return Err("link expired");
    }
    let action = match action.as_str() {
        "start" => {
            if until <= now || until > now + MAX_WINDOW_MS {
                return Err("bad end time");
            }
            Action::Start
        }
        "stop" => Action::Stop,
        _ => return Err("unknown action"),
    };
    if !nonces.check_and_remember(&nonce) {
        return Err("link already used");
    }
    Ok(Command { action, until })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Same vector as packages/domain/src/companion.test.ts
    const SECRET: &str = "dGVzdC1zZWNyZXQtZm9yLWxpZmVvcy1jb21wYW5pb24";
    const SIG: &str = "2e05c61299b0356232071a4cd967591ad5c817dd2cfbe392ef2398b5e1bc08a2";
    const UNTIL: i64 = 1793350800000;
    const IAT: i64 = 1793349000000;
    const NONCE: &str = "00112233445566778899aabb";

    fn link(sig: &str) -> String {
        format!("lifeos-companion://focus?action=start&until={UNTIL}&iat={IAT}&nonce={NONCE}&sig={sig}")
    }

    #[test]
    fn accepts_the_shared_vector() {
        let mut n = NonceCache::default();
        assert_eq!(verify(&link(SIG), SECRET, IAT + 1000, &mut n), Ok(Command { action: Action::Start, until: UNTIL }));
    }

    #[test]
    fn rejects_tampering_wrong_secret_replay_and_age() {
        let mut n = NonceCache::default();
        let bad_sig = format!("{}00", &SIG[..62]);
        assert_eq!(verify(&link(&bad_sig), SECRET, IAT, &mut n), Err("bad signature"));
        assert_eq!(verify(&link(SIG), "another-secret", IAT, &mut n), Err("bad signature"));
        assert_eq!(verify(&link(SIG).replace("until=1793350800000", "until=1793351800000"), SECRET, IAT, &mut n), Err("bad signature"));
        assert_eq!(verify(&link(SIG), SECRET, IAT + MAX_AGE_MS + 1, &mut n), Err("link expired"));
        assert!(verify(&link(SIG), SECRET, IAT, &mut n).is_ok());
        assert_eq!(verify(&link(SIG), SECRET, IAT, &mut n), Err("link already used"));
        assert_eq!(verify(&link(SIG), "", IAT, &mut n), Err("not paired"));
    }
}
