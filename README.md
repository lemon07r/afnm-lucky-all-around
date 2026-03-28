# Lucky All Around x6

Simple AFNM mod that replaces the vanilla shuffled pity-event exclusivity multiplier with a fixed `6x` multiplier for every pity event.

## Build

```bash
bun install
bun run build
```

The packaged mod zip is written to `builds/afnm-lucky-all-around-x6.zip`.

## Notes

- Targets AFNM `0.6.46-a4ebf2c`.
- The runtime patch preserves the vanilla explore flow, including unlocks, character encounters, cooldowns, and global pity tracking, while swapping the pity multiplier itself to `6x`.
