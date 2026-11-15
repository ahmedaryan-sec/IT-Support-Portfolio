/* ============================================================
   BSOD — Blue Screen of Death Field Guide
   ============================================================ */
"use strict";

/* ------------------------------------------------------------
   1. CATEGORIES
------------------------------------------------------------ */
const CATS = {
  driver:   { label: "Drivers",          icon: "wrench",       color: "#38bdf8" },
  memory:   { label: "Memory & RAM",     icon: "memory-stick", color: "#a78bfa" },
  storage:  { label: "Storage & Files",  icon: "hard-drive",   color: "#34d399" },
  boot:     { label: "Boot & Startup",   icon: "power",        color: "#fbbf24" },
  system:   { label: "Windows Kernel",   icon: "layers",       color: "#f472b6" },
  hardware: { label: "Hardware",         icon: "cpu",          color: "#fb7185" },
};

/* ------------------------------------------------------------
   2. STOP CODE DATABASE  (variant = the real-life screen style)
   win10  → Windows 10/11 sad-face QR screen (#0078D7)
   green  → Windows Insider green screen
   win7   → Windows 7 classic white-text screen (#0000A8)
   repair → "Recovery / Your PC needs to be repaired" screen
------------------------------------------------------------ */
const ERRORS = [
{
  id:"critical-process-died", name:"CRITICAL_PROCESS_DIED", code:"0x000000EF",
  cat:"system", variant:"win10",
  short:"A critical Windows process such as csrss.exe stopped running unexpectedly.",
  causes:["Corrupt system files","Bad Windows update","Faulty driver"],
  steps:[
    {t:"Scan & repair system files", d:"Right-click Start → Terminal (Admin). Run <code>sfc /scannow</code> and wait for 'Verification 100% complete' — it rebuilds damaged system files."},
    {t:"Deep-repair the Windows image", d:"In the same admin terminal run <code>DISM /Online /Cleanup-Image /RestoreHealth</code>. Needs internet, takes 10–20 minutes, fixes what SFC can't."},
    {t:"Remove the latest update", d:"Settings → Windows Update → Update history → Uninstall updates. If crashes started right after Patch Tuesday, remove that cumulative update."},
    {t:"Update the classic crash trio", d:"Win+X → Device Manager. Update Display adapters, Network adapters and Storage controllers first — they kill critical processes most often."},
    {t:"Check the disk for damage", d:"Admin terminal: <code>chkdsk C: /f /r</code> → press Y → restart. Repairs corrupted sectors that keep damaging system files."},
    {t:"Roll Windows back in time", d:"Search Start for 'Create a restore point' → System Restore. Pick a restore point dated before the first crash."},
  ],
},
{
  id:"system-thread-exception", name:"SYSTEM_THREAD_EXCEPTION_NOT_HANDLED", code:"0x0000007E",
  cat:"driver", variant:"win10", file:"nvlddmkm.sys",
  short:"A driver threw an error Windows couldn't catch — the filename in brackets names it.",
  causes:["Outdated GPU drivers","Incompatible software","Overclocking"],
  steps:[
    {t:"Read the .sys filename", d:"The bracket after the stop code (e.g. nvlddmkm.sys = NVIDIA GPU) names the guilty driver. Search that filename to identify its device."},
    {t:"Update that exact driver", d:"Device Manager → right-click the device → Update driver. For GPUs, grab the fresh installer from the NVIDIA / AMD / Intel website instead."},
    {t:"Roll back if it just updated", d:"Device Manager → double-click device → Driver tab → Roll Back Driver. Undoes the update that triggered the crashes."},
    {t:"Strip overclocks away", d:"Enter BIOS (Del/F2 at boot) → Load Optimized Defaults (F9) → Save & Exit (F10). Close tuning tools like MSI Afterburner too."},
    {t:"Repair damaged system files", d:"Admin terminal: <code>sfc /scannow</code>, then <code>DISM /Online /Cleanup-Image /RestoreHealth</code>."},
    {t:"Purge recent software", d:"Settings → Apps → Installed apps → sort by Install date. Remove anything installed days before the first crash, then restart."},
  ],
},
{
  id:"kmode-exception", name:"KMODE_EXCEPTION_NOT_HANDLED", code:"0x0000001E",
  cat:"system", variant:"win10",
  short:"Kernel-mode code executed a bad instruction — usually a misbehaving driver or dodgy RAM.",
  causes:["Buggy drivers","Faulty RAM","Old antivirus hooks"],
  steps:[
    {t:"Update every major driver", d:"Win+X → Device Manager. Refresh display, network and chipset drivers — kernel exceptions love old ones."},
    {t:"Uninstall the newest additions", d:"Settings → Apps → sort by Install date. Remove software and drivers installed right before the crashes began."},
    {t:"Run the memory diagnostic", d:"Win+R → type <code>mdsched.exe</code> → Enter → 'Restart now and check for problems'. Any errors = that RAM stick is suspect."},
    {t:"Disable Fast Startup", d:"Control Panel → Power Options → 'Choose what the power buttons do' → uncheck 'Turn on fast startup' → Save changes."},
    {t:"Take every Windows update", d:"Settings → Windows Update → Check for updates — including Optional updates → Driver updates."},
    {t:"Still crashing? Scan SFC", d:"Admin terminal: <code>sfc /scannow</code> to replace corrupted kernel components."},
  ],
},
{
  id:"system-service-exception", name:"SYSTEM_SERVICE_EXCEPTION", code:"0x0000003B",
  cat:"driver", variant:"win10", file:"fltmgr.sys",
  short:"Code jumped into privileged mode and a driver broke the rules — GPUs and antivirus top the list.",
  causes:["Graphics drivers","Third-party antivirus","Bad Windows update"],
  steps:[
    {t:"Clean-update the GPU driver", d:"Download fresh from NVIDIA / AMD / Intel and tick 'Clean installation' during setup — wipes corrupt driver leftovers."},
    {t:"Uninstall the last Windows update", d:"Settings → Windows Update → Update history → Uninstall updates. This stop code is famous for appearing right after one."},
    {t:"Temporarily remove antivirus", d:"Uninstall the third-party AV (Windows Defender takes over automatically). If blue screens stop, you found the culprit."},
    {t:"Test the RAM", d:"Win+R → <code>mdsched.exe</code> → restart and let it scan. Memory errors corrupt system services exactly like this."},
    {t:"Run SFC", d:"Admin terminal: <code>sfc /scannow</code> and let it finish; reboot afterwards."},
    {t:"Check app conflicts", d:"Vpn clients, screen recorders and RGB software hook deep into system services — uninstall recent ones and observe for a few days."},
  ],
},
{
  id:"irql-not-less", name:"IRQL_NOT_LESS_OR_EQUAL", code:"0x0000000A",
  cat:"driver", variant:"win7",
  short:"A driver or kernel process touched memory at too high an interrupt priority level.",
  causes:["Driver bugs","Faulty RAM","Overheating / overclock"],
  steps:[
    {t:"Run Windows Memory Diagnostic", d:"Win+R → <code>mdsched.exe</code> → 'Restart now and check for problems'. This absolute classic of a stop code is RAM until proven innocent."},
    {t:"Test sticks one by one", d:"Power off, unplug, remove all but one RAM stick, use the PC. Repeat per stick — the one that crashes alone needs replacing."},
    {t:"Update network & GPU drivers", d:"Device Manager → Network adapters + Display adapters → Update driver. Faulty Wi-Fi drivers cause a huge share of IRQL crashes."},
    {t:"Roll back suspicious drivers", d:"Device Manager → device → Driver tab → Roll Back Driver for anything updated right before the blue screens."},
    {t:"Remove filter drivers", d:"Uninstall recently added VPNs, firewalls or antivirus — their network filter drivers poke straight at IRQL level."},
    {t:"Reset clocks & watch temps", d:"BIOS → Load Optimized Defaults. Keep CPU under roughly 85 °C — heat makes marginal memory errors permanent blue screens."},
  ],
},
{
  id:"driver-irql", name:"DRIVER_IRQL_NOT_LESS_OR_EQUAL", code:"0x000000D1",
  cat:"driver", variant:"win10", file:"netwtw06.sys",
  short:"Same crime as IRQL_NOT_LESS_OR_EQUAL — but Windows points at the driver file directly.",
  causes:["Named driver is broken","New hardware","Corrupt driver install"],
  steps:[
    {t:"Note the .sys file on screen", d:"The 'What failed' line names the file (netwtw06.sys = Intel Wi-Fi, rtwlanu.sys = Realtek Wi-Fi). That's your target."},
    {t:"Update it from the vendor", d:"Get the newest driver from the laptop / chip maker's site — not just Windows Update — and install it manually."},
    {t:"Nuke & reinstall the device", d:"Device Manager → right-click the device → Uninstall device → restart. Windows reinstalls a clean, fresh copy."},
    {t:"Roll back recent driver updates", d:"Driver tab → Roll Back Driver, if the crashes began after an update."},
    {t:"Test the RAM anyway", d:"<code>mdsched.exe</code> — drivers get blamed for errors that flaky memory actually causes."},
    {t:"System file sweep", d:"Admin terminal: <code>sfc /scannow</code>."},
  ],
},
{
  id:"page-fault", name:"PAGE_FAULT_IN_NONPAGED_AREA", code:"0x00000050",
  cat:"memory", variant:"win7",
  short:"Windows looked for data that must always stay in RAM — and it simply wasn't there.",
  causes:["Bad RAM","Corrupt pagefile","Driver touching freed memory"],
  steps:[
    {t:"Check the disk", d:"Admin terminal: <code>chkdsk C: /f /r</code> → Y → restart. Let it run all stages undisturbed."},
    {t:"Run the memory diagnostic", d:"Win+R → <code>mdsched.exe</code>. For certainty, follow up with an overnight MemTest86 from a USB stick — 0 errors is the only pass."},
    {t:"Reseat the RAM physically", d:"Power off + unplug. Remove sticks, polish contacts with a pencil eraser, click them firmly back into the slots."},
    {t:"Rebuild the pagefile", d:"Settings → About → Advanced system settings → Performance Settings → Advanced → Virtual memory → set 'No paging file' → restart → set 'System managed' → restart again."},
    {t:"Update drivers", d:"Display, storage and antivirus-level drivers are the usual page-fault writers. Update or roll them back."},
    {t:"Scan system files", d:"Admin terminal: <code>sfc /scannow</code>."},
  ],
},
{
  id:"memory-management", name:"MEMORY_MANAGEMENT", code:"0x0000001A",
  cat:"memory", variant:"win10",
  short:"Windows' memory manager caught corruption while keeping its books — prime suspect: RAM.",
  causes:["Failing RAM","Too-aggressive XMP profile","Driver memory leaks"],
  steps:[
    {t:"Run MemTest86 overnight", d:"Flash MemTest86 to a USBstick, boot it, run 4 full passes. One single error means faulty RAM — full stop."},
    {t:"Test one stick at a time", d:"Isolate the bad module by running the PC on individual sticks for a day each."},
    {t:"Disable XMP / EXPO", d:"BIOS → set memory to stock JEDEC speed (2133/3200 MT/s). Stable-after-this = your RAM kit or its XMP profile is the problem."},
    {t:"Reseat in the right slots", d:"Desktop dual-channel usually wants A2+B2 (check the board manual). Click until both latches snap."},
    {t:"Update BIOS & chipset", d:"From the motherboard maker's support page — memory training fixes are the most common BIOS changelog entry."},
    {t:"Replace the bad module", d:"RAM is a lifetime-warranty part — RMA the failing stick once tests identify it."},
  ],
},
{
  id:"pfn-list-corrupt", name:"PFN_LIST_CORRUPT", code:"0x0000004E",
  cat:"memory", variant:"win10",
  short:"The list Windows uses to track every physical RAM page got corrupted mid-flight.",
  causes:["Bad RAM","Driver writing out of bounds","Disk corruption"],
  steps:[
    {t:"Memory diagnostic first", d:"<code>mdsched.exe</code> — PFN corruption is overwhelmingly a hardware RAM issue."},
    {t:"Repair system & image files", d:"Admin terminal: <code>sfc /scannow</code> then <code>DISM /Online /Cleanup-Image /RestoreHealth</code>."},
    {t:"Check the disk", d:"<code>chkdsk C: /f /r</code> — corrupt sectors feed garbage into the page-frame list."},
    {t:"Update storage & chipset drivers", d:"These drivers directly manage memory transfers; get them fresh from the manufacturer."},
    {t:"Remove recent drivers", d:"Roll back or uninstall drivers added just before the crashes."},
    {t:"Install pending Windows updates", d:"Settings → Windows Update — memory-management bugs are routinely patched there."},
  ],
},
{
  id:"kernel-security", name:"KERNEL_SECURITY_CHECK_FAILURE", code:"0x00000139",
  cat:"memory", variant:"win10",
  short:"Windows detected corruption in a critical data structure — RAM and drivers share the blame.",
  causes:["Driver conflicts","Faulty RAM","Antivirus leftovers"],
  steps:[
    {t:"Full memory test", d:"<code>mdsched.exe</code> for a quick pass, then MemTest86 for the definitive verdict."},
    {t:"Update all drivers", d:"Device Manager sweep — display, network, storage. Then the laptop maker's own support-app for the rest."},
    {t:"Roll back the newest driver", d:"If crashes started after a specific driver update: Driver tab → Roll Back Driver."},
    {t:"Hunt antivirus ghosts", d:"Old, uninstalled antivirus leaves kernel drivers behind. Run the vendor's official removal/cleanup tool."},
    {t:"SFC + DISM combo", d:"<code>sfc /scannow</code> then <code>DISM /Online /Cleanup-Image /RestoreHealth</code> in an admin terminal."},
    {t:"Kill the overclock", d:"BIOS → Load Optimized Defaults → Save & Exit. Overclocked memory controllers trip this check constantly."},
  ],
},
{
  id:"heap-corruption", name:"KERNEL_MODE_HEAP_CORRUPTION", code:"0x0000013A",
  cat:"memory", variant:"win10",
  short:"A driver corrupted the kernel's internal memory heap — Insider builds show it in green.",
  causes:["GPU driver bugs","RAM instability","Tuning tools"],
  steps:[
    {t:"Clean-install the GPU driver", d:"Fresh download from NVIDIA / AMD / Intel → 'Clean installation'. Heap corruption traces to display drivers more than anything."},
    {t:"Close the tuning tools", d:"MSI Afterburner, RGB suites, fan controllers inject into the kernel heap. Exit or uninstall them and test."},
    {t:"Test the RAM", d:"<code>mdsched.exe</code> → restart. Heap corruption and bad memory are frequent partners."},
    {t:"Set RAM to stock speed", d:"BIOS → disable XMP/EXPO temporarily → if crash-free for a week, tune the kit manually or RMA it."},
    {t:"SFC + DISM", d:"Admin terminal: <code>sfc /scannow</code>, then <code>DISM /Online /Cleanup-Image /RestoreHealth</code>."},
    {t:"Update chipset drivers", d:"From Intel / AMD directly — they arbitrate between drivers and kernel memory."},
  ],
},
{
  id:"critical-structure", name:"CRITICAL_STRUCTURE_CORRUPTION", code:"0x00000109",
  cat:"system", variant:"win10",
  short:"Something modified kernel code that it had absolutely no business touching.",
  causes:["Emulators / virtualizers","Old anti-cheat or VPN drivers","Bad RAM"],
  steps:[
    {t:"Uninstall kernel-level tools", d:"Android emulators, old virtualizers, outdated anti-cheat and VPN clients write into the kernel. Remove them and reboot."},
    {t:"Run the memory test", d:"<code>mdsched.exe</code> — genuine RAM corruption also flips kernel structures."},
    {t:"SFC + DISM", d:"<code>sfc /scannow</code> then <code>DISM /Online /Cleanup-Image /RestoreHealth</code> restores un-tampered kernel files."},
    {t:"Clean boot", d:"Win+R → <code>msconfig</code> → Services → 'Hide all Microsoft services' → Disable all → restart. Re-enable half at a time to find the offender."},
    {t:"Update drivers & Windows", d:"Both, fully — this error often dies quietly after a cumulative update."},
  ],
},
{
  id:"video-tdr", name:"VIDEO_TDR_FAILURE", code:"0x00000116",
  cat:"driver", variant:"win10", file:"nvlddmkm.sys",
  short:"The graphics driver froze and Windows' recovery watchdog gave up on it.",
  causes:["GPU driver crash","Unstable / hot GPU","Browser acceleration"],
  steps:[
    {t:"Decode the filename", d:"nvlddmkm.sys = NVIDIA, atikmpag.sys = AMD, igdkmd64.sys = Intel. That tells you which driver to attack."},
    {t:"Clean-install GPU drivers", d:"Download from the manufacturer's site → choose 'Factory reset / Clean install' so no corrupt profiles survive."},
    {t:"Kill browser hardware acceleration", d:"Browser Settings → System → toggle 'Use hardware acceleration' OFF → test for a week. Huge trigger for TDR timeouts."},
    {t:"Give the driver more breathing room", d:"Optional registry mercy: admin terminal <code>reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\" /v TdrDelay /t REG_DWORD /d 10</code> → restart. Only if the steps above failed."},
    {t:"Cool and un-clock the GPU", d:"Clean dust, verify fans spin, remove any overclock/undervolt, keep hotspot under ~90 °C (check with HWiNFO)."},
    {t:"Rule out the RAM", d:"<code>mdsched.exe</code> — shared-memory GPUs lean on system RAM."},
  ],
},
{
  id:"thread-stuck", name:"THREAD_STUCK_IN_DEVICE_DRIVER", code:"0x000000EA",
  cat:"driver", variant:"win10", file:"atikmdag.sys",
  short:"A thread got trapped inside the graphics driver in an endless spin loop.",
  causes:["Stuck GPU driver","GPU overheating","Very old BIOS"],
  steps:[
    {t:"Clean-update the GPU driver", d:"Manufacturer download → clean install. This error is the GPU driver almost every time."},
    {t:"Disable hardware acceleration in apps", d:"Browsers, Discord, Teams — toggle it off and observe. Each disabled app removes a crash path."},
    {t:"Check temperatures under load", d:"Watch GPU temp in Task Manager → Performance → GPU or HWiNFO. Over ~85 °C sustained = clean the heatsink and re-paste."},
    {t:"Update the BIOS", d:"From the PC/motherboard maker, with the laptop plugged in and never interrupted. BIOS updates fix GPU-handoff bugs."},
    {t:"Update the chipset driver", d:"Intel/AMD chipset package — it owns the PCIe bus the GPU is stuck waiting on."},
    {t:"Memory sanity check", d:"<code>mdsched.exe</code> to close the loop."},
  ],
},
{
  id:"dpc-watchdog", name:"DPC_WATCHDOG_VIOLATION", code:"0x00000133",
  cat:"driver", variant:"win10", file:"iastora.sys",
  short:"A driver hogged the CPU at high priority too long, so the watchdog shot the session.",
  causes:["Old SATA / SSD drivers","Outdated SSD firmware","External devices"],
  steps:[
    {t:"Swap in the Standard SATA driver", d:"Device Manager → IDE ATA/ATAPI controllers → SATA AHCI Controller → Update driver → Browse my computer → Let me pick → 'Standard SATA AHCI Controller'. Fixes a famous specific crash."},
    {t:"Update SSD firmware", d:"Use the vendor tool (Samsung Magician, Crucial Storage Executive, WD Dashboard). Old NVMe firmware is the #2 cause."},
    {t:"Update chipset & storage drivers", d:"From the motherboard or laptop maker — Intel RST especially."},
    {t:"Unplug recent USB gear", d:"Docks, DACs, capture cards added just before the crashes? Remove them and test a few days."},
    {t:"SFC sweep", d:"Admin terminal: <code>sfc /scannow</code>."},
    {t:"Disk health pass", d:"<code>chkdsk C: /f /r</code> scheduled at next boot."},
  ],
},
{
  id:"power-state", name:"DRIVER_POWER_STATE_FAILURE", code:"0x0000009F",
  cat:"driver", variant:"win10",
  short:"A driver failed to sleep or wake on time when Windows changed power states.",
  causes:["Wi-Fi / Bluetooth drivers","USB power saving","Fast startup"],
  steps:[
    {t:"Turn off Fast Startup", d:"Control Panel → Power Options → 'Choose what the power buttons do' → Change settings that are currently unavailable → uncheck 'Turn on fast startup'."},
    {t:"Update the wireless driver", d:"Get Wi-Fi/Bluetooth drivers from the maker's site — the Windows-auto ones age badly and cause most power-state deaths."},
    {t:"Stop USB power napping", d:"Device Manager → Universal Serial Bus controllers → each USB Root Hub → Properties → Power Management → uncheck 'Allow the computer to turn off this device'."},
    {t:"Eject hardware added recently", d:"Anything plugged in days before the start of the crashes is a suspect — remove and test."},
    {t:"Roll back the newest driver", d:"Driver tab → Roll Back Driver on the last-updated device."},
    {t:"SFC + DISM", d:"<code>sfc /scannow</code> then <code>DISM /Online /Cleanup-Image /RestoreHealth</code>."},
  ],
},
{
  id:"bad-pool-header", name:"BAD_POOL_HEADER", code:"0x00000019",
  cat:"driver", variant:"win10",
  short:"A driver made an invalid request against the kernel's memory pool.",
  causes:["New driver or software","Bad RAM","Corrupt ntfs index"],
  steps:[
    {t:"Remove what changed last", d:"Settings → Apps → sort by Install date → uninstall the newest entries; unplug the newest hardware too."},
    {t:"Roll back recent drivers", d:"Device Manager → suspicious device → Driver tab → Roll Back Driver."},
    {t:"Memory diagnostic", d:"<code>mdsched.exe</code> — pool corruption is frequently memory that can't hold a bit."},
    {t:"SFC sweep", d:"Admin terminal: <code>sfc /scannow</code>."},
    {t:"Take optional driver updates", d:"Settings → Windows Update → Advanced options → Optional updates → Driver updates."},
    {t:"Clean boot to isolate", d:"<code>msconfig</code> → hide Microsoft services → disable all → re-enable in halves to corner the culprit."},
  ],
},
{
  id:"apc-index", name:"APC_INDEX_MISMATCH", code:"0x00000001",
  cat:"driver", variant:"win10", file:"win32kfull.sys",
  short:"A driver entered and exited protected sections an unequal number of times.",
  causes:["Audio / display drivers","Virtual device drivers","Update mismatch"],
  steps:[
    {t:"Update audio + display drivers", d:"Realtek audio and GPU drivers dominate this error — refresh both from their makers."},
    {t:"Remove virtual drivers", d:"Virtual audio cables, screen-mirroring tools and old peripheral software leave APC-abusing drivers behind. Uninstall them."},
    {t:"Roll back the last driver", d:"If it began after an update: Driver tab → Roll Back Driver."},
    {t:"Install Windows updates", d:"Settings → Windows Update, including Optional → Driver updates — mismatched system components trigger APC faults."},
    {t:"SFC sweep", d:"<code>sfc /scannow</code>."},
    {t:"Full malware scan", d:"Windows Security → Virus & threat protection → Scan options → Full scan. Rootkits love APC tricks."},
  ],
},
{
  id:"ntfs-file-system", name:"NTFS_FILE_SYSTEM", code:"0x00000024",
  cat:"storage", variant:"win10",
  short:"The NTFS file-system driver crashed into corruption on disk — or a dying disk itself.",
  causes:["Failing HDD/SSD","File-system corruption","Antivirus filters"],
  steps:[
    {t:"Immediate disk check", d:"Admin terminal: <code>chkdsk C: /f /r</code> → Y → restart. Expect an hour plus on large drives — let it finish."},
    {t:"Read the drive's own health", d:"Admin terminal: <code>wmic diskdrive get status</code> must answer 'OK'. 'Pred Fail' or a 'Caution' in CrystalDiskInfo = back up NOW."},
    {t:"SFC sweep", d:"<code>sfc /scannow</code> fixes a corrupted ntfs.sys itself."},
    {t:"Disable third-party antivirus briefly", d:"AV filter drivers sit inside the file system — a buggy one blue-screens exactly here."},
    {t:"Update storage & chipset drivers", d:"From the manufacturer, not just Windows Update."},
    {t:"Plan the disk's retirement", d:"NTFS errors that keep returning after clean chkdsk = the drive is dying. Clone it, replace it, move on."},
  ],
},
{
  id:"fat-file-system", name:"FAT_FILE_SYSTEM", code:"0x00000023",
  cat:"storage", variant:"win10",
  short:"The FAT/FAT32 driver found corrupt file structures — frequently on removable USB media.",
  causes:["USB pulled mid-write","Bad sectors","Driver bugs"],
  steps:[
    {t:"Chkdsk the offending drive", d:"Admin terminal: <code>chkdsk E: /f /r</code> (swap E: for the real letter of the drive that crashed you)."},
    {t:"Unplug extras and reboot test", d:"Remove every non-essential USB device, then use the PC normally — reintroduce one per day to find the trigger."},
    {t:"Update storage & chipset drivers", d:"Motherboard/laptop maker's support page."},
    {t:"SFC sweep", d:"<code>sfc /scannow</code> for the fastfat.sys driver itself."},
    {t:"Format the sick USB drive", d:"After backing up: right-click drive → Format → (uncheck Quick for a deep scrub). Recurring FAT corruption on a flash drive means replace it."},
  ],
},
{
  id:"inaccessible-boot", name:"INACCESSIBLE_BOOT_DEVICE", code:"0x0000007B",
  cat:"boot", variant:"win10",
  short:"Windows lost contact with the drive it booted from — classic after BIOS or driver changes.",
  causes:["SATA mode changed in BIOS","Missing storage driver","Loose drive / cable"],
  steps:[
    {t:"Restore the BIOS storage mode", d:"Enter BIOS (Del/F2) → SATA Operation → switch AHCI ↔ RAID/Intel RST back to however Windows was installed → Save & Exit. 90% of cases die right here."},
    {t:"Force your way into Safe Mode", d:"Interrupt boot 3× (hold power as Windows loads) → Recovery → Troubleshoot → Startup Settings → press 4. If Safe Mode boots, uninstall the latest driver/update from there."},
    {t:"Rebuild the boot records", d:"Troubleshoot → Command Prompt: <code>bootrec /fixmbr</code>, <code>bootrec /fixboot</code>, <code>bootrec /rebuildbcd</code>."},
    {t:"Reseat the drive physically", d:"Desktop: re-seat SATA + power cables. Laptop: re-seat the M.2 stick by its retaining screw. Cables creep."},
    {t:"Update storage controller driver", d:"In Safe Mode: Device Manager → Storage controllers → Update driver (Intel RST / chipset from the maker)."},
    {t:"Nuclear option: Startup Repair", d:"Boot a Windows install USB (made on another PC with the Media Creation Tool) → Repair your computer → Startup Repair."},
  ],
},
{
  id:"unmountable-boot", name:"UNMOUNTABLE_BOOT_VOLUME", code:"0x000000ED",
  cat:"boot", variant:"win10",
  short:"Windows couldn't read the structure of its own system volume at startup.",
  causes:["Corrupted file system","Bad cable","Failing drive"],
  steps:[
    {t:"Deep chkdsk from Recovery", d:"Interrupt boot 3× → Troubleshoot → Command Prompt → <code>chkdsk c: /r</code> (yes, c:). Hours is normal — never interrupt it."},
    {t:"Repair the boot sectors", d:"Same Command Prompt: <code>bootrec /fixmbr</code> then <code>bootrec /rebuildbcd</code>."},
    {t:"Try automatic Startup Repair", d:"Troubleshoot → Startup Repair — surprisingly effective on exactly this code."},
    {t:"Check the cable", d:"Swap the SATA cable (they die silently) and change to another motherboard port while you're in there."},
    {t:"Listen to the drive", d:"Clicking, beeping, or SMART 'Caution' = clone everything off it immediately and replace the drive."},
  ],
},
{
  id:"bad-system-config", name:"BAD_SYSTEM_CONFIG_INFO", code:"0x00000074",
  cat:"boot", variant:"win10",
  short:"The Registry or Boot Configuration Data that Windows needs to start is broken.",
  causes:["Corrupt registry","RAM writing garbage","Manual BCD edits"],
  steps:[
    {t:"Run Startup Repair", d:"Interrupt boot 3× → Troubleshoot → Startup Repair. It rebuilds common BCD breakage automatically."},
    {t:"Hand-fix the boot data", d:"Troubleshoot → Command Prompt: <code>bootrec /fixmbr</code>, <code>bootrec /fixboot</code>, <code>bootrec /rebuildbcd</code>."},
    {t:"Test the RAM that wrote it", d:"Once back in Windows: <code>mdsched.exe</code> — corrupted registry hives usually came from bad memory, not magic."},
    {t:"Restore a saved registry", d:"Advanced, from Recovery Command Prompt — copy backups from C:\\Windows\\System32\\config\\RegBack over the broken hives in ..\\config."},
    {t:"System Restore", d:"Troubleshoot → System Restore → pick a point before the breakage."},
    {t:"Reset Windows, keep files", d:"Troubleshoot → Reset this PC → Keep my files. Reinstalls Windows without touching your documents."},
  ],
},
{
  id:"unexpected-store", name:"UNEXPECTED_STORE_EXCEPTION", code:"0x00000154",
  cat:"storage", variant:"win10",
  short:"The kernel's store component died without warning — the modern signature of SSD trouble.",
  causes:["SSD failing","Fast startup quirk","Intel RST conflicts"],
  steps:[
    {t:"Disable Fast Startup first", d:"Power Options → 'Choose what the power buttons do' → uncheck 'Turn on fast startup'. This error's single most common cure."},
    {t:"Replace Intel Rapid Storage", d:"Uninstall 'Intel RST' from Apps, then reinstall the fresh version from your PC maker — or run without it."},
    {t:"Interrogate the SSD's health", d:"CrystalDiskInfo → anything but a blue 'Good' = start backing up. Also update its firmware via the vendor tool."},
    {t:"Chkdsk the system drive", d:"Admin terminal: <code>chkdsk C: /f /r</code> → Y → restart."},
    {t:"Update chipset drivers", d:"Straight from Intel/AMD — storage stack included."},
    {t:"SFC sweep", d:"<code>sfc /scannow</code> to close out system-file doubts."},
  ],
},
{
  id:"whea", name:"WHEA_UNCORRECTABLE_ERROR", code:"0x00000124",
  cat:"hardware", variant:"win10",
  short:"The CPU reported a hardware-level error that Windows had no way to correct.",
  causes:["Overclock / voltage","Overheating","Failing CPU, RAM or PSU"],
  steps:[
    {t:"Strip every overclock", d:"BIOS → Load Optimized Defaults (F9). Uninstall auto-OC utilities too — even the board maker's own 'AI' overclocker."},
    {t:"Actually cool the CPU", d:"Clean dust filters, confirm fans spin, re-seat the cooler with fresh thermal paste. Target: under 85 °C at full load."},
    {t:"Update BIOS + chipset", d:"From the board maker — CPU microcode updates ship inside BIOS releases and cure many WHEA storms."},
    {t:"MemTest86, four passes", d:"Boot it from USB overnight. RAM errors surface as WHEA because the CPU reports them."},
    {t:"Audit the PSU", d:"HWiNFO sensors: 12 V / 5 V / 3.3 V rails within ±5%. Re-seat the 24-pin and CPU 8-pin cables. Aging PSUs are notorious WHEA engines."},
    {t:"Map the crash pattern", d:"Crashes only under heavy CPU load with perfect RAM and clean temps = RMA time for processor or board."},
  ],
},
{
  id:"machine-check", name:"MACHINE_CHECK_EXCEPTION", code:"0x0000009C",
  cat:"hardware", variant:"win10",
  short:"The CPU itself phoned Windows to report a fatal internal error.",
  causes:["Bad power delivery","Heat","Dying component"],
  steps:[
    {t:"Back to bone-stock", d:"BIOS defaults — no XMP, no OC, no fancy boost. Stability first, speed later."},
    {t:"Deep-clean the cooling", d:"Heatsinks, fans, filters inside and out. A machine-check is often a machine-cooking."},
    {t:"Reseat the power connectors", d:"24-pin ATX and the 8-pin EPS CPU cable — unplug, inspect for scorch marks, clip back in hard."},
    {t:"Test RAM stick by stick", d:"One module at a time for a day each. Machine checks blame the CPU for memory that's dying."},
    {t:"Update the BIOS", d:"New microcode = new CPU behaviour fixes. Flash per the maker's instructions, never mid-storm."},
    {t:"Stress-test to convict", d:"Prime95 (CPU), MemTest86 (RAM): whichever component errors first under its specific test is the one to RMA."},
  ],
},
{
  id:"clock-watchdog", name:"CLOCK_WATCHDOG_TIMEOUT", code:"0x00000101",
  cat:"hardware", variant:"win10",
  short:"CPU cores stopped checking in with each other in time — one core ignored the interrupt.",
  causes:["Unstable RAM / XMP","Ancient BIOS","Core instability"],
  steps:[
    {t:"Run RAM at stock", d:"BIOS → XMP/EXPO off. Memory that's 'XMP-stable' frequently isn't — this is the tell."},
    {t:"MemTest86 verification", d:"4 passes, zero errors allowed. Multi-core sync errors are flaky RAM until tests clear them."},
    {t:"Update the BIOS", d:"Board maker's site. CLOCK_WATCHDOG fixes are bread-and-butter BIOS changelog entries."},
    {t:"Update chipset drivers", d:"From Intel/AMD — interrupt routing lives there."},
    {t:"Install Windows updates", d:"All of them; core-scheduling fixes ship through Windows Update."},
    {t:"Watch core temps", d:"One core running >95 °C can freeze its interrupt responses — re-paste and re-seat the cooler if so."},
  ],
},
{
  id:"unexpected-trap", name:"UNEXPECTED_KERNEL_MODE_TRAP", code:"0x0000007F",
  cat:"system", variant:"win10",
  short:"The CPU trapped a condition the kernel couldn't handle — the classic dust-off-RAM fix.",
  causes:["Poorly seated RAM","Heat","Driver conflict"],
  steps:[
    {t:"Reseat every stick", d:"Power off, unplug, press each RAM stick out and back in until both latches click. This error's legendary cure."},
    {t:"Clean while you're inside", d:"Compressed air over RAM slots, fans and heatsinks — overheating is the co-conspirator."},
    {t:"Isolate the bad stick", d:"Run on one module at a time; <code>mdsched.exe</code> backs you up with a software verdict."},
    {t:"Remove overclocks", d:"BIOS → Load Optimized Defaults."},
    {t:"SFC + DISM", d:"<code>sfc /scannow</code> then <code>DISM /Online /Cleanup-Image /RestoreHealth</code>."},
    {t:"Update the troublemaking drivers", d:"Especially anything installed right before the traps began."},
  ],
},
];

/* ------------------------------------------------------------
   3. PROGRESS PERSISTENCE (checkbox state survives reloads)
------------------------------------------------------------ */
const LS_KEY = "bsod-progress-v1";
let progress = {};
try { progress = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { progress = {}; }
const saveProgress = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch (e) {} };
const doneOf = e => (progress[e.id] || []).filter(Boolean).length;

/* ------------------------------------------------------------
   4. SVG BUILDERS — screen-accurate replicas
------------------------------------------------------------ */
const FONT = `'Segoe UI', system-ui, sans-serif`;
const MONO = `Consolas, "Lucida Console", monospace`;

/* mini QR look-alike (decorative, like the real stopcode QR) */
function qr(x, y, s) {
  const u = s / 19;
  let cells = "";
  for (let r = 0; r < 19; r++) for (let c = 0; c < 19; c++) {
    const inFinder = (r < 5 && c < 5) || (r < 5 && c >= 14) || (r >= 14 && c < 5);
    const on = ((r * 31 + c * 17 + ((r * c) % 7)) % 5) < 2;
    if (!inFinder && on)
      cells += `<rect x="${(x + c * u + u * 0.12).toFixed(1)}" y="${(y + r * u + u * 0.12).toFixed(1)}" width="${(u * 0.76).toFixed(1)}" height="${(u * 0.76).toFixed(1)}"/>`;
  }
  const finder = (fx, fy) =>
    `<rect x="${x + fx * u}" y="${y + fy * u}" width="${5 * u}" height="${5 * u}"/>` +
    `<rect x="${x + (fx + 1) * u}" y="${y + (fy + 1) * u}" width="${3 * u}" height="${3 * u}" fill="#fff"/>` +
    `<rect x="${x + (fx + 1.4) * u}" y="${y + (fy + 1.4) * u}" width="${2.2 * u}" height="${2.2 * u}"/>`;
  return `<rect x="${x - 3}" y="${y - 3}" width="${s + 6}" height="${s + 6}" rx="2" fill="#fff"/>` +
    `<g fill="#111">${cells}${finder(0, 0)}${finder(14, 0)}${finder(0, 14)}</g>`;
}

/* Windows 10 / 11 modern sad-face screen (and green Insider variant) */
function svgModern(e) {
  const green = e.variant === "green";
  const bg = green ? "#00653A" : "#0078D7";
  const line1 = green ? "Your Windows Insider Build ran into a problem and" : "Your PC ran into a problem and needs to restart.";
  const line2 = green ? "needs to restart. We're just collecting some error info," : "We're just collecting some error info, and then we'll";
  const line3 = green ? "and then we'll restart for you." : "restart for you.";
  const failedLine = e.file
    ? `<text x="132" y="337" font-family="${FONT}" font-size="9.5" fill="#fff">What failed: ${e.file}</text>`
    : "";
  return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${e.name} blue screen">
  <rect width="640" height="360" fill="${bg}"/>
  <text x="58" y="146" font-family="${FONT}" font-size="104" fill="#fff">:(</text>
  <text x="58" y="200" font-family="${FONT}" font-size="17.5" fill="#fff">${line1}</text>
  <text x="58" y="226" font-family="${FONT}" font-size="17.5" fill="#fff">${line2}</text>
  <text x="58" y="252" font-family="${FONT}" font-size="17.5" fill="#fff">${line3}</text>
  <text x="58" y="272" font-family="${FONT}" font-size="12" fill="#fff" class="pct">(64% complete)</text>
  ${qr(58, 284, 56)}
  <text x="132" y="297" font-family="${FONT}" font-size="9.5" fill="#fff">For more information about this issue and possible fixes, visit</text>
  <text x="132" y="309" font-family="${FONT}" font-size="9.5" fill="#fff">https://www.windows.com/stopcode</text>
  <text x="132" y="326" font-family="${FONT}" font-size="9" fill="#fff">If you call a support person, give them this info:</text>
  <text x="132" y="337" font-family="${FONT}" font-size="9" fill="#fff">Stop code: ${e.name}</text>
  ${failedLine.replace('y="337"', 'y="349"')}
</svg>`;
}

/* Windows 7 era classic wall-of-text screen */
function svgWin7(e) {
  const L = (y, txt, w) => `<text x="320" y="${y}" text-anchor="middle" font-family="${MONO}" font-size="12.5" fill="#fff"${w ? ' font-weight="bold"' : ""}>${txt}</text>`;
  return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${e.name} classic blue screen">
  <rect width="640" height="360" fill="#0000A8"/>
  ${L(52, "A problem has been detected and Windows has been shut down to prevent damage")}
  ${L(67, "to your computer.")}
  ${L(103, e.name, 1)}
  ${L(135, "If this is the first time you've seen this Stop error screen,")}
  ${L(150, "restart your computer. If this screen appears again, follow these steps:")}
  ${L(180, "Check to make sure any new hardware or software is properly installed.")}
  ${L(195, "If this is a new installation, ask your hardware or software manufacturer")}
  ${L(210, "for any Windows updates you might need.")}
  ${L(240, "If problems continue, disable or remove any newly installed hardware")}
  ${L(255, "or software. Disable BIOS memory options such as caching or shadowing.")}
  ${L(285, "Technical information:")}
  ${L(303, "*** STOP: ${e.code} (0x00000000, 0x00000000, 0x00000000, 0x00000000)")}
</svg>`;
}

/* Windows 8/10 "Recovery — Your PC needs to be repaired" screen */
function svgRepair(e) {
  const L = (x, y, txt, s, o) => `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${s}" fill="#fff"${o || ""}>${txt}</text>`;
  return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${e.name} recovery screen">
  <rect width="640" height="360" fill="#0A85EA"/>
  ${L(70, 122, "Recovery", 46)}
  ${L(70, 158, "Your PC needs to be repaired", 20)}
  ${L(70, 186, "The operating system couldn't be loaded because a required device", 13)}
  ${L(70, 203, "isn't connected or can't be accessed.", 13)}
  ${L(70, 233, "Error code: 0xc000000e", 13, ' font-family="Consolas, monospace"')}
  ${L(70, 260, "You'll need to use recovery tools on your installation media.", 13)}
  ${L(70, 305, "Press Enter to try again", 12)}
  ${L(70, 322, "Press F8 for Startup Settings", 12)}
  ${L(70, 339, "Press Esc for UEFI Firmware Settings", 12)}
</svg>`;
}

function svgIrql() {
  return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="IRQL_NOT_LESS_OR_EQUAL blue screen">
  <rect width="640" height="360" fill="#0078D7"/>
  <text x="58" y="100" font-family="${FONT}" font-size="90" fill="#fff">:(</text>
  <text x="58" y="145" font-family="${FONT}" font-size="16" fill="#fff">Your PC ran into a problem and needs to restart. We're just</text>
  <text x="58" y="168" font-family="${FONT}" font-size="16" fill="#fff">collecting some error info, and then we'll restart for you.</text>
  <text x="58" y="205" font-family="${FONT}" font-size="13" fill="#fff">25% complete</text>
  ${qr(58, 225, 65)}
  <text x="134" y="235" font-family="${FONT}" font-size="10" fill="#fff">For more information about this issue and</text>
  <text x="134" y="250" font-family="${FONT}" font-size="10" fill="#fff">possible fixes, visit</text>
  <text x="134" y="265" font-family="${FONT}" font-size="10" fill="#fff">http://windows.com/stopcode</text>
  <text x="134" y="295" font-family="${FONT}" font-size="9" fill="#fff">If you call a support person, give them this info:</text>
  <text x="134" y="308" font-family="${FONT}" font-size="9" fill="#fff">Stop code: IRQL_NOT_LESS_OR_EQUAL</text>
</svg>`;
}

function svgPageFault() {
  return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PAGE_FAULT_IN_NONPAGED_AREA blue screen">
  <rect width="640" height="360" fill="#0078D7"/>
  <text x="64" y="130" font-family="${FONT}" font-size="90" fill="#fff">:(</text>
  <text x="64" y="175" font-family="${FONT}" font-size="18" fill="#fff">Your PC ran into a problem and needs to restart. We'll</text>
  <text x="64" y="200" font-family="${FONT}" font-size="18" fill="#fff">restart for you.</text>
  ${qr(72, 245, 60)}
  <text x="142" y="255" font-family="${FONT}" font-size="9.5" fill="#fff">For more information about this issue and possible fixes, visit</text>
  <text x="142" y="268" font-family="${FONT}" font-size="9.5" fill="#fff">https://www.windows.com/stopcode</text>
  <text x="142" y="298" font-family="${FONT}" font-size="8.5" fill="#fff">If you call a support person, give them this info:</text>
  <text x="142" y="310" font-family="${FONT}" font-size="8.5" fill="#fff">Stop code: PAGE_FAULT_IN_NONPAGED_AREA</text>
  <text x="142" y="322" font-family="${FONT}" font-size="8.5" fill="#fff">What failed: WimFsf.sys</text>
</svg>`;
}

function svgHeap() {
  return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="KERNEL_MODE_HEAP_CORRUPTION blue screen">
  <rect width="640" height="360" fill="#002BF6"/>
  <text x="32" y="100" font-family="${FONT}" font-size="90" fill="#fff">:(</text>
  <text x="32" y="145" font-family="${FONT}" font-size="16" fill="#fff">Your device ran into a problem and needs to restart.</text>
  <text x="32" y="168" font-family="${FONT}" font-size="16" fill="#fff">We're just collecting some error info, and then you can</text>
  <text x="32" y="191" font-family="${FONT}" font-size="16" fill="#fff">restart.</text>
  <text x="38" y="225" font-family="${FONT}" font-size="14" fill="#fff">100% complete</text>
  ${qr(40, 245, 65)}
  <text x="115" y="252" font-family="${FONT}" font-size="9.5" fill="#fff">For more information about this issue and possible fixes, visit</text>
  <text x="115" y="266" font-family="${FONT}" font-size="9.5" fill="#fff">https://www.windows.com/stopcode</text>
  <text x="115" y="298" font-family="${FONT}" font-size="8.5" fill="#fff">If you call a support person, give them this info:</text>
  <text x="115" y="310" font-family="${FONT}" font-size="8.5" fill="#fff">Stop Code: KERNEL_MODE_HEAP_CORRUPTION</text>
</svg>`;
}

function svgUnmountable() {
  return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="UNMOUNTABLE_BOOT_VOLUME blue screen">
  <rect width="640" height="360" fill="#0078D7"/>
  <text x="64" y="130" font-family="${FONT}" font-size="90" fill="#fff">:(</text>
  <text x="64" y="175" font-family="${FONT}" font-size="18" fill="#fff">Your device ran into a problem and needs to restart. We'll restart for</text>
  <text x="64" y="200" font-family="${FONT}" font-size="18" fill="#fff">you.</text>
  ${qr(64, 255, 55)}
  <text x="130" y="265" font-family="${FONT}" font-size="9" fill="#fff">For more information about this issue and possible fixes, visit https://www.windows.com/stopcode</text>
  <text x="130" y="295" font-family="${FONT}" font-size="8.5" fill="#fff">If you call a support person, give them this info:</text>
  <text x="130" y="308" font-family="${FONT}" font-size="8.5" fill="#fff">Stop code: UNMOUNTABLE_BOOT_VOLUME</text>
</svg>`;
}

function svgTrap() {
  return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="UNEXPECTED_KERNEL_MODE_TRAP blue screen">
  <rect width="640" height="360" fill="#0078D7"/>
  <text x="64" y="100" font-family="${FONT}" font-size="90" fill="#fff">:(</text>
  <text x="64" y="145" font-family="${FONT}" font-size="16" fill="#fff">Your PC ran into a problem and needs to restart. We're just collecting</text>
  <text x="64" y="168" font-family="${FONT}" font-size="16" fill="#fff">some error info, and then we'll restart for you.</text>
  <text x="64" y="205" font-family="${FONT}" font-size="13" fill="#fff">40% complete</text>
  ${qr(64, 235, 55)}
  <text x="130" y="242" font-family="${FONT}" font-size="8.5" fill="#fff">For more information about this issue and possible fixes, visit https://www.windows.com/stopcode</text>
  <text x="130" y="275" font-family="${FONT}" font-size="8.5" fill="#fff">If you call a support person, give them this info:</text>
  <text x="130" y="288" font-family="${FONT}" font-size="8.5" fill="#fff">Stop code: UNEXPECTED KERNEL MODE TRAP</text>
</svg>`;
}

function svgInaccessible() {
  return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="INACCESSIBLE_BOOT_DEVICE blue screen">
  <rect width="640" height="360" fill="#0078D7"/>
  <text x="36" y="120" font-family="${FONT}" font-size="90" fill="#fff">:(</text>
  <text x="36" y="165" font-family="${FONT}" font-size="15" fill="#fff">Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.</text>
  <text x="36" y="200" font-family="${FONT}" font-size="13" fill="#fff">93% complete</text>
  ${qr(36, 230, 68)}
  <text x="115" y="245" font-family="${FONT}" font-size="10" fill="#fff">For more information about this issue and possible fixes, visit</text>
  <text x="115" y="260" font-family="${FONT}" font-size="10" fill="#fff">http://windows.com/stopcode</text>
  <text x="115" y="295" font-family="${FONT}" font-size="9.5" fill="#fff">If you call a support person, give them this info:</text>
  <text x="115" y="310" font-family="${FONT}" font-size="9.5" fill="#fff">Stop code: INACCESSIBLE_BOOT_DEVICE</text>
</svg>`;
}

function svgKmode() {
  return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="KMODE_EXCEPTION_NOT_HANDLED blue screen">
  <rect width="640" height="360" fill="#002BF6"/>
  <text x="50" y="110" font-family="${FONT}" font-size="95" fill="#fff">:(</text>
  <text x="50" y="160" font-family="${FONT}" font-size="17" fill="#fff">Your device ran into a problem and needs to restart.</text>
  <text x="50" y="184" font-family="${FONT}" font-size="17" fill="#fff">We're just collecting some error info, and then we'll</text>
  <text x="50" y="208" font-family="${FONT}" font-size="17" fill="#fff">restart for you.</text>
  <text x="58" y="240" font-family="${FONT}" font-size="15" fill="#fff">0% complete</text>
  ${qr(60, 260, 68)}
  <text x="142" y="268" font-family="${FONT}" font-size="8.5" fill="#fff">For more information about this issue and possible fixes, visit</text>
  <text x="142" y="282" font-family="${FONT}" font-size="8.5" fill="#fff">https://www.windows.com/stopcode</text>
  <text x="142" y="312" font-family="${FONT}" font-size="8" fill="#fff">If you call a support person, give them this info:</text>
  <text x="142" y="324" font-family="${FONT}" font-size="8" fill="#fff">Stop code: KMODE_EXCEPTION_NOT_HANDLED</text>
</svg>`;
}

function bsodSVG(e) {
  if (e.id === "irql-not-less") return svgIrql();
  if (e.id === "page-fault") return svgPageFault();
  if (e.id === "heap-corruption") return svgHeap();
  if (e.id === "unmountable-boot") return svgUnmountable();
  if (e.id === "unexpected-trap") return svgTrap();
  if (e.id === "inaccessible-boot") return svgInaccessible();
  if (e.id === "kmode-exception") return svgKmode();

  if (e.variant === "win7") return svgWin7(e);
  if (e.variant === "repair") return svgRepair(e);
  return svgModern(e);
}

/* ------------------------------------------------------------
   5. CARD GRID
------------------------------------------------------------ */
const grid = document.getElementById("errorGrid");
const state = { cat: "all", q: "" };

function progBadge(e) {
  const done = doneOf(e);
  if (!done) return "";
  const full = done >= e.steps.length;
  return `<span class="prog-badge ${full ? "done" : ""}"><i data-lucide="check"></i>${done}/${e.steps.length}</span>`;
}

function cardHTML(e) {
  const c = CATS[e.cat];
  return `<article class="card reveal in" data-id="${e.id}" tabindex="0" role="button" aria-label="Open step-by-step fix for ${e.name}">
  <div class="card-screen">${bsodSVG(e)}${progBadge(e)}</div>
  <div class="card-body">
    <div class="card-top">
      <span class="cat-chip" style="--c:${c.color}"><i data-lucide="${c.icon}"></i>${c.label}</span>
      <span class="hex">${e.code}</span>
    </div>
    <h3 class="card-name">${e.name}</h3>
    <p class="card-short">${e.short}</p>
    <div class="card-cta">
      <span class="btn-fix"><i data-lucide="wrench"></i>Step-by-step fix</span>
      <i data-lucide="arrow-right" class="go"></i>
    </div>
  </div>
</article>`;
}

function renderGrid() {
  const q = state.q.toLowerCase();
  const list = ERRORS.filter(e =>
    (state.cat === "all" || e.cat === state.cat) &&
    (!q || (e.name + " " + e.code + " " + e.short + " " + CATS[e.cat].label).toLowerCase().includes(q))
  );
  grid.innerHTML = list.length
    ? list.map(cardHTML).join("")
    : `<div class="empty"><i data-lucide="bug"></i><p><b>No stop code matches that search.</b><br/>Try “memory”, “nvlddmkm” or a hex code like 0x0116.</p></div>`;
  document.getElementById("resultCount").textContent =
    `// showing ${list.length} of ${ERRORS.length} stop codes`;
  lucide.createIcons();
}

/* category filter chips */
function renderChips() {
  const counts = ERRORS.reduce((a, e) => ((a[e.cat] = (a[e.cat] || 0) + 1), a), {});
  const chips = [{ id: "all", label: "All screens", icon: "layers", n: ERRORS.length }]
    .concat(Object.keys(CATS).map(k => ({ id: k, label: CATS[k].label, icon: CATS[k].icon, n: counts[k] || 0 })));
  document.getElementById("chipRow").innerHTML = chips.map(c =>
    `<button class="chip-btn ${c.id === state.cat ? "active" : ""}" data-cat="${c.id}"><i data-lucide="${c.icon}"></i>${c.label} · ${c.n}</button>`
  ).join("");
  lucide.createIcons();
}

document.getElementById("chipRow").addEventListener("click", ev => {
  const b = ev.target.closest(".chip-btn");
  if (!b) return;
  state.cat = b.dataset.cat;
  renderChips(); renderGrid();
});
document.getElementById("searchInput").addEventListener("input", ev => {
  state.q = ev.target.value.trim();
  renderGrid();
});

/* open modal from cards (mouse + keyboard) */
grid.addEventListener("click", ev => {
  const card = ev.target.closest(".card");
  if (card) openModal(card.dataset.id);
});
grid.addEventListener("keydown", ev => {
  const card = ev.target.closest(".card");
  if (card && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); openModal(card.dataset.id); }
});

/* ------------------------------------------------------------
   6. MODAL — step-by-step rescue checklist
------------------------------------------------------------ */
const overlay = document.getElementById("modalOverlay");
const modalBody = document.getElementById("modalBody");
let currentId = null;

function modalHTML(e) {
  const c = CATS[e.cat];
  const done = doneOf(e);
  const pct = Math.round((done / e.steps.length) * 100);
  const cap = {
    win10: "Real Windows 10 / 11 stop screen — recreated pixel-close in SVG.",
    green: "Windows Insider Preview green screen — recreated in SVG.",
    win7:  "Windows 7 / XP era stop screen — recreated in SVG.",
    repair:"Windows Recovery boot screen — recreated in SVG.",
  }[e.variant];
  const steps = e.steps.map((s, i) => `<li>
    <label class="step">
      <input type="checkbox" data-i="${i}" ${(progress[e.id] || [])[i] ? "checked" : ""}/>
      <span class="step-num"></span>
      <span class="box"><i data-lucide="check"></i></span>
      <span class="step-text"><b>${i + 1}. ${s.t}</b>${s.d}</span>
    </label>
  </li>`).join("");
  return `
  <div class="m-tags">
    <span class="cat-chip" style="--c:${c.color}"><i data-lucide="${c.icon}"></i>${c.label}</span>
    <span class="hex">${e.code}</span>
  </div>
  <h2 class="m-name">${e.name}</h2>
  <p class="m-short">${e.short}</p>

  <figure class="m-screen">${bsodSVG(e)}<figcaption><i data-lucide="monitor"></i>${cap}</figcaption></figure>

  <p class="m-sec-label"><i data-lucide="info"></i>Usual suspects</p>
  <div class="causes">${e.causes.map(x => `<span class="cause">${x}</span>`).join("")}</div>

  <p class="m-sec-label"><i data-lucide="wrench"></i>Rescue checklist — tick each step off</p>
  <div class="m-progress">
    <span id="mCount">${done}/${e.steps.length}</span>
    <div class="m-bar"><div class="m-fill" id="mFill" style="width:${pct}%"></div></div>
    <button class="m-reset" id="mReset"><i data-lucide="rotate-ccw"></i>reset</button>
  </div>
  <ol class="steps">${steps}</ol>
  <div class="all-done" id="mDone"><i data-lucide="check"></i>Every fix attempted — use the PC for a few days. Crash-free? Victory.</div>
  <p class="m-official">Still crashing? Microsoft keeps the master list at
    <a href="https://www.windows.com/stopcode" target="_blank" rel="noopener">windows.com/stopcode<i data-lucide="external-link"></i></a>
  </p>`;
}

function openModal(id) {
  const e = ERRORS.find(x => x.id === id);
  if (!e) return;
  currentId = id;
  modalBody.innerHTML = modalHTML(e);
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("lock");
  document.getElementById("modalPanel").scrollTop = 0;
  lucide.createIcons();
  document.getElementById("modalClose").focus();
  updateModalProgress();
}

function closeModal() {
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lock");
  currentId = null;
  renderGrid(); // refresh progress badges
}

function updateModalProgress() {
  const e = ERRORS.find(x => x.id === currentId);
  if (!e) return;
  const done = doneOf(e);
  const count = document.getElementById("mCount");
  const fill = document.getElementById("mFill");
  const banner = document.getElementById("mDone");
  if (count) count.textContent = `${done}/${e.steps.length}`;
  if (fill) fill.style.width = `${Math.round((done / e.steps.length) * 100)}%`;
  if (banner) banner.classList.toggle("show", done === e.steps.length && e.steps.length > 0);
}

modalBody.addEventListener("change", ev => {
  const input = ev.target.closest("input[type=checkbox][data-i]");
  if (!input || !currentId) return;
  const i = +input.dataset.i;
  if (!progress[currentId]) progress[currentId] = [];
  progress[currentId][i] = input.checked;
  saveProgress();
  updateModalProgress();
});
modalBody.addEventListener("click", ev => {
  if (ev.target.closest("#mReset") && currentId) {
    progress[currentId] = [];
    saveProgress();
    openModal(currentId);
  }
});
document.getElementById("modalClose").addEventListener("click", closeModal);
overlay.addEventListener("click", ev => { if (ev.target === overlay) closeModal(); });
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && overlay.classList.contains("open")) closeModal(); });

/* ------------------------------------------------------------
   7. HERO — animated live replica
------------------------------------------------------------ */
(function hero() {
  const heroErr = {
    name: "MANUALLY_INITIATED_CRASH", variant: "win10",
    short: "", causes: [], steps: [],
  };
  document.getElementById("heroScreen").innerHTML = bsodSVG(heroErr);
  const pctEl = document.querySelector("#heroScreen .pct");
  let p = 0;
  setInterval(() => {
    p = p >= 100 ? 0 : p + Math.floor(Math.random() * 13) + 3;
    if (pctEl) pctEl.textContent = `(${Math.min(p, 99)}% complete)`;
  }, 850);
})();

/* ------------------------------------------------------------
   8. REVEAL ON SCROLL + INIT
------------------------------------------------------------ */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach(el => io.observe(el));

document.getElementById("stepCount").textContent = ERRORS.reduce((a, e) => a + e.steps.length, 0);
document.getElementById("headerCount").textContent = ERRORS.length;

renderChips();
renderGrid();
lucide.createIcons();
