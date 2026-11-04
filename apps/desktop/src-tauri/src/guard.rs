//! Focus guard session state. Pure: callers pass `now` in epoch milliseconds.
//! The guard always has an end time and turns itself off when it passes.

use std::collections::HashMap;

pub const MAX_WINDOW_MS: i64 = 4 * 60 * 60 * 1000;
pub const SNOOZE_MS: i64 = 5 * 60 * 1000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    Manual,
    LifeOs,
}

#[derive(Default, Debug)]
pub struct Guard {
    until: Option<i64>,
    source: Option<Source>,
    snoozed: HashMap<String, i64>,
}

impl Guard {
    pub fn start(&mut self, until: i64, now: i64, source: Source) -> Result<(), String> {
        if until <= now {
            return Err("The end time has already passed.".into());
        }
        if until > now + MAX_WINDOW_MS {
            return Err("A focus guard can last at most 4 hours.".into());
        }
        self.until = Some(until);
        self.source = Some(source);
        self.snoozed.clear();
        Ok(())
    }

    /// Emergency stop / session end. Always succeeds.
    pub fn stop(&mut self) {
        self.until = None;
        self.source = None;
        self.snoozed.clear();
    }

    pub fn active_until(&self, now: i64) -> Option<i64> {
        self.until.filter(|u| *u > now)
    }

    pub fn source(&self, now: i64) -> Option<Source> {
        self.active_until(now).and(self.source)
    }

    pub fn snooze(&mut self, exe: &str, now: i64) {
        self.snoozed.insert(exe.to_ascii_lowercase(), now + SNOOZE_MS);
    }

    pub fn should_interrupt(&self, exe: &str, now: i64) -> bool {
        self.active_until(now).is_some()
            && self.snoozed.get(&exe.to_ascii_lowercase()).map(|t| *t <= now).unwrap_or(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const T: i64 = 1_793_350_000_000;

    #[test]
    fn runs_until_its_end_time_then_stops_itself() {
        let mut g = Guard::default();
        g.start(T + 25 * 60_000, T, Source::LifeOs).unwrap();
        assert!(g.should_interrupt("discord.exe", T + 60_000));
        assert!(!g.should_interrupt("discord.exe", T + 25 * 60_000));
        assert_eq!(g.active_until(T + 26 * 60_000), None);
    }

    #[test]
    fn rejects_past_and_overlong_windows() {
        let mut g = Guard::default();
        assert!(g.start(T - 1, T, Source::Manual).is_err());
        assert!(g.start(T + MAX_WINDOW_MS + 1, T, Source::Manual).is_err());
        assert_eq!(g.active_until(T), None);
    }

    #[test]
    fn snooze_is_per_app_and_temporary() {
        let mut g = Guard::default();
        g.start(T + 60 * 60_000, T, Source::Manual).unwrap();
        g.snooze("Discord.exe", T);
        assert!(!g.should_interrupt("discord.exe", T + 60_000));
        assert!(g.should_interrupt("steam.exe", T + 60_000));
        assert!(g.should_interrupt("discord.exe", T + SNOOZE_MS));
    }

    #[test]
    fn stop_always_works() {
        let mut g = Guard::default();
        g.start(T + 60_000, T, Source::Manual).unwrap();
        g.stop();
        assert!(!g.should_interrupt("discord.exe", T));
        assert_eq!(g.source(T), None);
    }
}
