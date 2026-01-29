# ROM Runner Layout Detection Profiles – Research Notes

Generated: 2026-01-05T03:49:53Z

## What this is
This document summarizes the evidence and reasoning used to build `layoutDetectionProfiles_v0_1_0.json`.
Profiles are keyed by `osId` values from `operating-systems_v2_0_0.json` and include:
- A default expected layout (roms/bios + optional saves/states/screenshots/portmaster)
- Detection markers (`markersAll`, `markersAny`, `markersNone`) and a confidence rating
- Optional variations that override the expected layout when alternate layouts are detected

## Notes / gaps
- The prompt requested **RetroBat**, but there is **no `osId` for RetroBat** in `operating-systems_v2_0_0.json`, so no profile was generated for it (would fail validation). Add a RetroBat OS entry first, then a profile can be added.
- The prompt requested a generic **`generic-linux-stock`** profile, but there is **no `osId` named `generic-linux-stock`** in `operating-systems_v2_0_0.json`. Instead, profiles were generated for the *stock* families that do exist (Anbernic stock Linux families, PowKiddy stock Linux family, etc.).
- Several *stock* OS families in `operating-systems_v2_0_0.json` use `__USER_SELECT__` for paths; those profiles are intentionally low-confidence because there is no single canonical folder layout.

## Profile-by-profile notes

### ArkOS (`arkos`)

**Expected layout (default):**
- roms: `/roms`
- bios: `/roms/bios`
- saves: `/roms/savestates`
- states: `/roms/savestates`
- screenshots: `/screenshots`
- portmaster: `/roms/ports`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/roms`
- `/roms/bios`
- markersAny:
- `/.ArkOS`
- `/opt/system/Advanced`
- `/roms2`
- markersNone:
- `/storage/.config/emuelec`
- `/userdata/system/batocera.conf`
- `/recalbox/share/system/recalbox.conf`
- `/.rocknix`

**Variations:**
- **ArkOS dual-SD (roms2)**
  - minimumConfidence: `high` (confidence: `high`)
  - markersAll: `/roms2`
  - layoutOverrides:
    - roms: `/roms2`
    - bios: `/roms2/bios`
    - saves: `/roms2/savestates`
    - states: `/roms2/savestates`
  - notes: ArkOS supports a dual (2) SD card setup; roms2 refers to the 2nd SD card for game files and BIOS can also be placed on the 2nd card.

**Notes:** Base layout matches ArkOS wiki guidance (roms in /roms; BIOS in /roms/bios).

**Sources / references:**
- https://github.com/christianhaitian/arkos/wiki
- https://github.com/christianhaitian/arkos/wiki/Frequently-Asked-Questions
- https://github.com/christianhaitian/arkos/wiki/Home

---

### ROCKNIX (`rocknix`)

**Expected layout (default):**
- roms: `/storage/roms`
- bios: `/storage/roms/bios`
- saves: `/storage/roms/savestates`
- states: `/storage/roms/savestates`
- screenshots: `/storage/screenshots`
- portmaster: `/storage/roms/ports`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/storage/.config/distribution`
- markersAny:
- `/.rocknix`
- `/roms`
- `/games-internal/roms`
- `/games-external/roms`
- markersNone:
- `/.ArkOS`
- `/userdata/system/batocera.conf`
- `/recalbox/share/system/recalbox.conf`

**Variations:**
- **ROCKNIX Samba share (/roms)**
  - minimumConfidence: `high` (confidence: `high`)
  - markersAll: `/roms`
  - markersAny: `/storage/.config/distribution`
  - layoutOverrides:
    - roms: `/roms`
    - bios: `/roms/bios`
    - saves: `/roms/saves`
    - states: `/roms/saves`
  - notes: Many users interact with ROCKNIX ROM storage via a /roms share; internal mountpoints may differ.
- **ROCKNIX internal games-internal (/games-internal/roms)**
  - minimumConfidence: `high` (confidence: `high`)
  - markersAll: `/games-internal/roms`
  - layoutOverrides:
    - roms: `/games-internal/roms`
    - bios: `/games-internal/roms/bios`
  - notes: ROCKNIX documentation references /games-internal/roms as an internal location.

**Notes:** ROCKNIX (JELOS successor) uses internal /storage paths; documentation also references /games-internal/roms and a /roms share.

**Sources / references:**
- https://rocknix.org/
- https://rocknix.org/faqs/
- https://rocknix.org/docs/users/adding-games/

---

### JELOS (`jelos`)

**Expected layout (default):**
- roms: `/storage/roms`
- bios: `/storage/roms/bios`
- saves: `/storage/roms/savestates`
- states: `/storage/roms/savestates`
- screenshots: `/storage/screenshots`
- portmaster: `/storage/roms/ports`

**Detection markers:**
- minimumConfidence: `medium` (base confidence: `medium`)
- markersAll:
- `/storage/.config/distribution`
- `/storage/.update`
- markersAny:
- `/roms`
- `/storage/games-internal`
- `/storage/games-external`
- markersNone:
- `/.rocknix`

**Variations:**
- **JELOS Samba share (/roms)**
  - minimumConfidence: `medium` (confidence: `medium`)
  - markersAll: `/roms`
  - markersAny: `/storage/.config/distribution`
  - markersNone: `/.rocknix`
  - layoutOverrides:
    - roms: `/roms`
    - bios: `/roms/bios`
  - notes: Many JELOS guides reference a /roms share; internal mountpoints may differ.

**Notes:** JELOS is end-of-life; detection relies on common LibreELEC-style markers and excludes ROCKNIX where possible.

**Sources / references:**
- https://jelos.org/
- https://github.com/JustEnoughLinuxOS/distribution

---

### AmberELEC (`amberelec`)

**Expected layout (default):**
- roms: `/storage/roms`
- bios: `/storage/roms/bios`
- saves: `/storage/roms/savestates`
- states: `/storage/roms/savestates`
- screenshots: `/storage/screenshots`
- portmaster: `/storage/roms/ports`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/storage/roms`
- `/storage/.config`
- markersAny:
- `/.amberelec`
- `/roms`
- `/roms/gamedata`
- markersNone:
- `/.rocknix`
- `/.ArkOS`
- `/userdata/system/batocera.conf`

**Variations:**
- **AmberELEC Samba share (/roms)**
  - minimumConfidence: `high` (confidence: `high`)
  - markersAll: `/roms`
  - markersAny: `/storage/.config`
  - layoutOverrides:
    - roms: `/roms`
    - bios: `/roms/bios`
  - notes: Some setups expose ROM storage via a /roms share.

**Notes:** AmberELEC documentation references /storage/roms and /storage/.config.

**Sources / references:**
- https://amberelec.org/
- https://amberelec.org/getting-started

---

### Batocera (`batocera`)

**Expected layout (default):**
- roms: `/userdata/roms`
- bios: `/userdata/bios`
- saves: `/userdata/saves`
- states: `/userdata/savestates`
- screenshots: `/userdata/screenshots`
- portmaster: `/userdata/roms/ports`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/userdata/system/batocera.conf`
- `/userdata/roms`
- markersAny:
- `/userdata/bios`
- `/userdata/saves`
- `/boot/batocera-boot.conf`
- markersNone:
- `/recalbox/share/system/recalbox.conf`

**Notes:** Batocera uses /userdata for share data (roms, bios, saves).

**Sources / references:**
- https://wiki.batocera.org/
- https://wiki.batocera.org/add_games_bios

---

### Lakka (`lakka`)

**Expected layout (default):**
- roms: `/storage/roms`
- bios: `/storage/system`
- saves: `/storage/savefiles`
- states: `/storage/savestates`
- screenshots: `/storage/screenshots`

**Detection markers:**
- minimumConfidence: `medium` (base confidence: `medium`)
- markersAll:
- `/storage/.config/retroarch/retroarch.cfg`
- markersAny:
- `/storage/roms`
- `/storage/downloads`
- markersNone:
- `/storage/.config/emuelec`
- `/storage/.config/amberelec`

**Notes:** Lakka is LibreELEC-based and RetroArch-centric; detection uses RetroArch config path and excludes EmuELEC/AmberELEC-specific markers.

**Sources / references:**
- https://www.lakka.tv/doc/Home/
- https://www.lakka.tv/doc/ROMs/

---

### EmuELEC (`emuelec`)

**Expected layout (default):**
- roms: `/storage/roms`
- bios: `/storage/roms/bios`
- saves: `/storage/roms/savestates`
- states: `/storage/roms/savestates`
- screenshots: `/storage/screenshots`
- portmaster: `/storage/roms/ports`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/storage/.config/emuelec/configs/emuelec.conf`
- markersAny:
- `/storage/roms`
- `/roms`
- `/storage/.config/emuelec`
- markersNone:
- (none)

**Variations:**
- **EmuELEC Samba share (/roms)**
  - minimumConfidence: `high` (confidence: `high`)
  - markersAll: `/roms`
  - markersAny: `/storage/.config/emuelec`
  - layoutOverrides:
    - roms: `/roms`
    - bios: `/roms/bios`
  - notes: Some setups expose ROM storage via a /roms share.

**Notes:** EmuELEC has a distinct configuration file location under /storage/.config/emuelec.

**Sources / references:**
- https://github.com/EmuELEC/EmuELEC/wiki
- https://github.com/EmuELEC/EmuELEC/wiki/EmuELEC-Settings#emuelec-settings

---

### Recalbox (`recalbox`)

**Expected layout (default):**
- roms: `/recalbox/share/roms`
- bios: `/recalbox/share/bios`
- saves: `/recalbox/share/saves`
- states: `/recalbox/share/saves`
- screenshots: `/recalbox/share/screenshots`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/recalbox/share/system/recalbox.conf`
- `/recalbox/share/roms`
- markersAny:
- `/recalbox/share/bios`
- `/recalbox/share/saves`
- markersNone:
- (none)

**Notes:** Recalbox share paths are under /recalbox/share.

**Sources / references:**
- https://wiki.recalbox.com/
- https://wiki.recalbox.com/en/basic-usage/getting-started/add-roms

---

### OnionOS (`onionos`)

**Expected layout (default):**
- roms: `/mnt/SDCARD/Roms`
- bios: `/mnt/SDCARD/BIOS`
- saves: `/mnt/SDCARD/Saves`
- states: `/mnt/SDCARD/Saves`
- screenshots: `/mnt/SDCARD/Screenshots`
- portmaster: `/mnt/SDCARD/Roms/PORTS`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/mnt/SDCARD/Roms`
- `/mnt/SDCARD/BIOS`
- markersAny:
- `/mnt/SDCARD/Apps`
- `/mnt/SDCARD/RetroArch`
- markersNone:
- (none)

**Notes:** OnionOS uses /mnt/SDCARD as SD root mountpoint.

**Sources / references:**
- https://github.com/OnionUI/Onion/wiki
- https://github.com/OnionUI/Onion/wiki/Installation

---

### GarlicOS (`garlicos`)

**Expected layout (default):**
- roms: `/mnt/SDCARD/Roms`
- bios: `/mnt/SDCARD/BIOS`
- saves: `/mnt/SDCARD/Saves`
- states: `/mnt/SDCARD/Saves`
- screenshots: `/mnt/SDCARD/Screenshots`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/mnt/SDCARD/Roms`
- `/mnt/SDCARD/BIOS`
- markersAny:
- `/CFW`
- `/roms`
- markersNone:
- (none)

**Notes:** GarlicOS uses /mnt/SDCARD on device; ROMs and BIOS are in /mnt/SDCARD/Roms and /mnt/SDCARD/BIOS.

**Sources / references:**
- https://www.patreon.com/posts/garlicos-for-76561333
- https://retrogamecorps.com/2023/01/03/anbernic-rg35xx-starter-guide/

---

### MinUI (`minui`)

**Expected layout (default):**
- roms: `/mnt/SDCARD/Roms`
- bios: `/mnt/SDCARD/Bios`
- saves: `/mnt/SDCARD/.userdata/shared/saves`
- states: `/mnt/SDCARD/.userdata/shared/states`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/Bios`
- `/Roms`
- `/MinUI.zip`
- markersAny:
- `/Saves`
- `/trimui`
- markersNone:
- (none)

**Notes:** MinUI installs by copying Bios, Roms, Saves, and MinUI.zip to SD root.

**Sources / references:**
- https://github.com/shauninman/MinUI
- https://retrogamecorps.com/2024/07/16/minui-installation-guide/

---

### muOS (`muos`)

**Expected layout (default):**
- roms: `/mnt/sdcard/roms`
- bios: `/mnt/sdcard/MUOS/bios`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/mnt/sdcard/MUOS/info/config/retroarch.cfg`
- `/mnt/sdcard/roms`
- markersAny:
- `/mnt/sdcard/BIOS`
- `/mnt/sdcard/MUOS`
- markersNone:
- (none)

**Variations:**
- **muOS alternate save root**
  - minimumConfidence: `medium` (confidence: `medium`)
  - markersAll: `/mnt/sdcard/MUOS`
  - layoutOverrides:
    - saves: `/mnt/sdcard/saves`
    - states: `/mnt/sdcard/saves`
  - notes: Some community guides reference top-level saves folders; included as a low-risk optional override.

**Notes:** muOS has a distinct MUOS directory and RetroArch config location.

**Sources / references:**
- https://muos.dev/
- https://muos.dev/help/retroarch

---

### CrossMix OS (`crossmix-os`)

**Expected layout (default):**
- roms: `/mnt/SDCARD/Roms`
- bios: `/mnt/SDCARD/BIOS`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/System`
- `/Roms`
- `/BIOS`
- markersAny:
- `/Apps`
- `/CrossMix-OS`
- `/Imgs`
- markersNone:
- (none)

**Notes:** CrossMix-OS distribution places System/Apps/Emus plus Roms/BIOS at SD root.

**Sources / references:**
- https://github.com/cizia64/CrossMix-OS

---

### Spruce (`spruce`)

**Expected layout (default):**
- roms: `/mnt/SDCARD/Roms`
- bios: `/mnt/SDCARD/BIOS`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/spruce`
- `/Roms`
- `/BIOS`
- markersAny:
- `/CreditsAndChangelog.txt`
- `/Updater`
- `/App`
- `/Emu`
- markersNone:
- (none)

**Notes:** Spruce bundles a /spruce directory plus standard Roms/BIOS folders and several app directories.

**Sources / references:**
- https://github.com/spruceOS/spruceOS
- https://retrohandhelds.gg/spruce-os-for-miyoo-a30-the-ultimate-cfw-setup-guide/

---

### EmuDeck (`emudeck`)

**Expected layout (default):**
- roms: `~/Emulation/roms`
- bios: `~/Emulation/bios`

**Detection markers:**
- minimumConfidence: `high` (base confidence: `high`)
- markersAll:
- `/Emulation/roms`
- `/Emulation/bios`
- markersAny:
- `/Emulation/tools`
- `/Emulation/saves`
- markersNone:
- (none)

**Variations:**
- **EmuDeck home directory (~/Emulation)**
  - minimumConfidence: `high` (confidence: `high`)
  - markersAll: `~/Emulation/roms`, `~/Emulation/bios`
  - layoutOverrides:
    - roms: `~/Emulation/roms`
    - bios: `~/Emulation/bios`
    - saves: `~/Emulation/saves`
    - states: `~/Emulation/saves`
  - notes: If scanning a running Steam Deck filesystem, EmuDeck uses ~/Emulation by default.

**Notes:** EmuDeck typically creates an Emulation directory with roms/bios/saves.

**Sources / references:**
- https://www.emudeck.com/
- https://emudeck.github.io/cheat-sheet/

---

### Retroid Stock (Android – modern devices) (`retroid-stock-android-modern`)

**Expected layout (default):**
- roms: `__USER_SELECT__`
- bios: `__USER_SELECT__`
- saves: `__USER_SELECT__`
- states: `__USER_SELECT__`
- screenshots: `__USER_SELECT__`

**Detection markers:**
- minimumConfidence: `low` (base confidence: `low`)
- markersAll:
- `/Android`
- markersAny:
- `/Android/data`
- `/Android/obb`
- markersNone:
- (none)

**Notes:** Android SD cards vary widely; detection is intentionally low-confidence and primarily checks for the Android folder.

---

### Retroid OS (`retroid-os`)

**Expected layout (default):**
- roms: `/storage/emulated/0/Roms`
- bios: `/storage/emulated/0/RetroArch/system`

**Detection markers:**
- minimumConfidence: `medium` (base confidence: `medium`)
- markersAll:
- `/games`
- `/games/download`
- markersAny:
- `/system`
- `/emulators`
- markersNone:
- (none)

**Notes:** RetroidOS commonly stores games under /games/download on the SD card.

**Sources / references:**
- https://wiki.retroidhandhelds.com/index.php?title=Getting_Started_with_RetroidOS

---

### Anbernic Stock (Android – RK3566 family) (`anbernic-stock-android-rk3566-family`)

**Expected layout (default):**
- roms: `__USER_SELECT__`
- bios: `__USER_SELECT__`
- saves: `__USER_SELECT__`
- states: `__USER_SELECT__`
- screenshots: `__USER_SELECT__`

**Detection markers:**
- minimumConfidence: `low` (base confidence: `low`)
- markersAll:
- `/Android`
- markersAny:
- `/Android/data`
- `/Android/obb`
- markersNone:
- (none)

**Notes:** Stock Android layouts vary; use Android folder presence only.

---

### Anbernic Stock (Android – T618 family) (`anbernic-stock-android-t618-family`)

**Expected layout (default):**
- roms: `__USER_SELECT__`
- bios: `__USER_SELECT__`
- saves: `__USER_SELECT__`
- states: `__USER_SELECT__`
- screenshots: `__USER_SELECT__`

**Detection markers:**
- minimumConfidence: `low` (base confidence: `low`)
- markersAll:
- `/Android`
- markersAny:
- `/Android/data`
- `/Android/obb`
- markersNone:
- (none)

**Notes:** Stock Android layouts vary; use Android folder presence only.

---

### Anbernic Stock (Android – T820 family) (`anbernic-stock-android-t820-family`)

**Expected layout (default):**
- roms: `__USER_SELECT__`
- bios: `__USER_SELECT__`
- saves: `__USER_SELECT__`
- states: `__USER_SELECT__`
- screenshots: `__USER_SELECT__`

**Detection markers:**
- minimumConfidence: `low` (base confidence: `low`)
- markersAll:
- `/Android`
- markersAny:
- `/Android/data`
- `/Android/obb`
- markersNone:
- (none)

**Notes:** Stock Android layouts vary; use Android folder presence only.

---

### Anbernic Stock (Linux – RG35XX / XX family) (`anbernic-stock-linux-rg35xx-family`)

**Expected layout (default):**
- roms: `__USER_SELECT__`
- bios: `__USER_SELECT__`
- saves: `__USER_SELECT__`
- states: `__USER_SELECT__`
- screenshots: `__USER_SELECT__`

**Detection markers:**
- minimumConfidence: `low` (base confidence: `low`)
- markersAll:
- `/roms`
- markersAny:
- `/bios`
- `/Roms`
- `/ROMS`
- markersNone:
- (none)

**Notes:** Stock Linux layouts differ by device/image; detection is low-confidence and may require user confirmation.

---

### Anbernic Stock (Linux – RK3566 family) (`anbernic-stock-linux-rk3566-family`)

**Expected layout (default):**
- roms: `__USER_SELECT__`
- bios: `__USER_SELECT__`
- saves: `__USER_SELECT__`
- states: `__USER_SELECT__`
- screenshots: `__USER_SELECT__`

**Detection markers:**
- minimumConfidence: `low` (base confidence: `low`)
- markersAll:
- `/roms`
- markersAny:
- `/bios`
- `/Roms`
- `/ROMS`
- markersNone:
- (none)

**Notes:** Stock Linux layouts differ by device/image; detection is low-confidence and may require user confirmation.

---

### MagicX Stock (Linux – Zero/XU family) (`magicx-stock-linux-family`)

**Expected layout (default):**
- roms: `__USER_SELECT__`
- bios: `__USER_SELECT__`
- saves: `__USER_SELECT__`
- states: `__USER_SELECT__`
- screenshots: `__USER_SELECT__`

**Detection markers:**
- minimumConfidence: `low` (base confidence: `low`)
- markersAll:
- `/roms`
- markersAny:
- `/bios`
- `/Roms`
- `/ROMS`
- markersNone:
- (none)

**Notes:** MagicX stock Linux layouts differ by model; detection is low-confidence.

---

### Miyoo Stock (Linux – Mini/Mini Plus family) (`miyoo-stock-family`)

**Expected layout (default):**
- roms: `__USER_SELECT__`
- bios: `__USER_SELECT__`
- saves: `__USER_SELECT__`
- states: `__USER_SELECT__`
- screenshots: `__USER_SELECT__`

**Detection markers:**
- minimumConfidence: `low` (base confidence: `low`)
- markersAll:
- `/Roms`
- markersAny:
- `/BIOS`
- `/Saves`
- `/.tmp_update`
- markersNone:
- (none)

**Notes:** Miyoo stock SD layouts vary; detection is low-confidence.

---

### PowKiddy Stock (Linux – common firmwares) (`powkiddy-stock-linux-family`)

**Expected layout (default):**
- roms: `__USER_SELECT__`
- bios: `__USER_SELECT__`
- saves: `__USER_SELECT__`
- states: `__USER_SELECT__`
- screenshots: `__USER_SELECT__`

**Detection markers:**
- minimumConfidence: `low` (base confidence: `low`)
- markersAll:
- `/roms`
- markersAny:
- `/bios`
- `/Roms`
- `/ROMS`
- markersNone:
- (none)

**Notes:** PowKiddy stock Linux layouts differ by model; detection is low-confidence.

---

### TrimUI Stock (Smart Pro / TrimUI OS) (`trimui-stock-trimuios-smart-pro`)

**Expected layout (default):**
- roms: `/Roms`
- bios: `/RetroArch/.retroarch/system`
- saves: `__USER_SELECT__`
- states: `__USER_SELECT__`
- screenshots: `__USER_SELECT__`

**Detection markers:**
- minimumConfidence: `low` (base confidence: `low`)
- markersAll:
- `/Roms`
- markersAny:
- `/System`
- `/Imgs`
- `/trimui`
- markersNone:
- (none)

**Notes:** TrimUI stock layouts can vary; detection is low-confidence.

---

### SteamOS (`steamos`)

**Expected layout (default):**
- roms: `~/Emulation/roms`
- bios: `~/Emulation/bios`
- saves: `~/Emulation/saves`
- states: `~/Emulation/states`
- screenshots: `~/Pictures/Screenshots`

**Detection markers:**
- minimumConfidence: `medium` (base confidence: `medium`)
- markersAll:
- `~/Emulation/roms`
- `~/Emulation/bios`
- markersAny:
- `~/Emulation/tools`
- `~/Emulation`
- `/Emulation/roms`
- `/Emulation/bios`
- markersNone:
- (none)

**Variations:**
- **SteamOS with SD-based Emulation folder (/Emulation)**
  - minimumConfidence: `high` (confidence: `high`)
  - markersAll: `/Emulation/roms`, `/Emulation/bios`
  - layoutOverrides:
    - roms: `/Emulation/roms`
    - bios: `/Emulation/bios`
    - saves: `/Emulation/saves`
    - states: `/Emulation/states`
  - notes: Some users place EmuDeck/Emulation directory at SD root as /Emulation.

**Notes:** SteamOS layout here is intentionally EmuDeck/Emulation-focused; SteamOS itself does not imply a specific ROM layout without tools like EmuDeck.

**Sources / references:**
- https://help.steampowered.com/en/faqs/view/671A-4453-E8D2-323C

---
