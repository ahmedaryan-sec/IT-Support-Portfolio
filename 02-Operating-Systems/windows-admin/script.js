/* ============================================================
   Windows Admin — IT Support Field Guide
   1. theme            2. boxes + modal      3. command search
   4. ticket builder    5. escalation        6. misc UI
   ============================================================ */
(function () {
  "use strict";

  /* ---------- storage ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", "");
        ta.style.position = "fixed"; ta.style.top = "-1000px";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        resolve();
      } catch (err) { reject(err); }
    });
  }

  function flash(btn, label) {
    var original = btn.textContent;
    btn.textContent = label;
    btn.classList.add("copied");
    window.setTimeout(function () { btn.textContent = original; btn.classList.remove("copied"); }, 1400);
  }

  /* ============================================================
     1. THEME
     ============================================================ */
  var ROOT = document.documentElement;
  var themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    ROOT.setAttribute("data-theme", theme);
    if (!themeToggle) return;
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    var icon = themeToggle.querySelector(".theme-icon");
    if (icon) icon.textContent = theme === "dark" ? "◐" : "◑";
  }

  var savedTheme = store.get("winadmin-theme", null);
  var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(savedTheme || (prefersLight ? "light" : "dark"));

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = ROOT.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      store.set("winadmin-theme", next);
    });
  }

  /* ============================================================
     2. BOXES + MODAL
     ============================================================ */
  var STATE_KEY = "winadmin-steps";
  var state = {};
  try { state = JSON.parse(store.get(STATE_KEY, "{}")) || {}; } catch (e) { state = {}; }
  function saveState() { store.set(STATE_KEY, JSON.stringify(state)); }

  var boxEls = Array.prototype.slice.call(document.querySelectorAll(".section-box"));
  var boxes = boxEls.map(function (el) {
    var key = el.getAttribute("data-open");
    var tpl = document.getElementById("tpl-" + key);
    var stepIds = [];
    if (tpl) {
      Array.prototype.forEach.call(tpl.content.querySelectorAll("input[data-step-id]"), function (i) {
        stepIds.push(i.getAttribute("data-step-id"));
      });
    }
    return {
      key: key, el: el, tpl: tpl, stepIds: stepIds,
      title: tpl ? tpl.getAttribute("data-title") : key,
      num: tpl ? tpl.getAttribute("data-num") : "",
      sub: tpl ? (tpl.getAttribute("data-sub") || "") : ""
    };
  });

  var byKey = {};
  boxes.forEach(function (b) { byKey[b.key] = b; });

  function countDone(ids) {
    var n = 0;
    ids.forEach(function (id) { if (state[id]) n++; });
    return n;
  }

  function renderBoxProgress() {
    boxes.forEach(function (b) {
      var total = b.stepIds.length, done = countDone(b.stepIds);
      var countEl = document.querySelector('[data-count="' + b.key + '"]');
      var progEl = document.querySelector('[data-progress="' + b.key + '"]');
      var fillEl = document.querySelector('[data-fill="' + b.key + '"]');
      if (countEl) countEl.textContent = total + " steps";
      if (progEl) progEl.textContent = done + "/" + total;
      if (fillEl) fillEl.style.width = (total ? (done / total) * 100 : 0) + "%";
      if (b.el) b.el.classList.toggle("complete", total > 0 && done === total);
    });
  }

  var modal = document.getElementById("modal");
  var modalBody = document.getElementById("modalBody");
  var modalTitle = document.getElementById("modalTitle");
  var modalNum = document.getElementById("modalNum");
  var modalSub = document.getElementById("modalSub");
  var modalMeterText = document.getElementById("modalMeterText");
  var modalMeterFill = document.getElementById("modalMeterFill");
  var modalReset = document.getElementById("modalReset");
  var modalPrev = document.getElementById("modalPrev");
  var modalNext = document.getElementById("modalNext");
  var modalPanel = modal ? modal.querySelector(".modal-panel") : null;

  var currentIndex = 0, lastFocused = null, isOpen = false;

  function renderMeter() {
    var box = boxes[currentIndex];
    if (!box) return;
    var total = box.stepIds.length, done = countDone(box.stepIds);
    if (modalMeterText) modalMeterText.textContent = done + " / " + total + " complete";
    if (modalMeterFill) modalMeterFill.style.width = total ? (done / total) * 100 + "%" : "0%";
  }

  function applyStateToModal() {
    if (!modalBody) return;
    Array.prototype.forEach.call(modalBody.querySelectorAll("input[data-step-id]"), function (input) {
      input.checked = !!state[input.getAttribute("data-step-id")];
      var step = input.closest(".step");
      if (step) step.classList.toggle("done", input.checked);
    });
  }

  function openBox(key) {
    var box = byKey[key];
    if (!box || !modal || !modalBody) return;
    currentIndex = boxes.indexOf(box);
    lastFocused = document.activeElement;
    modalTitle.textContent = box.title;
    modalNum.textContent = box.num;
    modalSub.textContent = box.sub;
    modalBody.innerHTML = "";
    if (box.tpl) modalBody.appendChild(box.tpl.content.cloneNode(true));
    applyStateToModal();
    renderMeter();
    modalBody.scrollTop = 0;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    isOpen = true;
    var closeBtn = modal.querySelector(".modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal || !isOpen) return;
    isOpen = false;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
    window.setTimeout(function () { if (!isOpen && modalBody) modalBody.innerHTML = ""; }, 240);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function stepBox(dir) {
    if (!boxes.length) return;
    openBox(boxes[(currentIndex + dir + boxes.length) % boxes.length].key);
  }

  document.addEventListener("click", function (e) {
    var opener = e.target.closest("[data-open]");
    if (opener && byKey[opener.getAttribute("data-open")]) {
      e.preventDefault();
      openBox(opener.getAttribute("data-open"));
      return;
    }
    if (e.target.closest("[data-close]")) { e.preventDefault(); closeModal(); }
  });

  if (modalPrev) modalPrev.addEventListener("click", function () { stepBox(-1); });
  if (modalNext) modalNext.addEventListener("click", function () { stepBox(1); });

  if (modalReset) {
    modalReset.addEventListener("click", function () {
      var box = boxes[currentIndex];
      if (!box) return;
      box.stepIds.forEach(function (id) { delete state[id]; });
      saveState(); applyStateToModal(); renderMeter(); renderBoxProgress();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!isOpen) return;
    if (e.key === "Escape") { closeModal(); return; }
    if (e.altKey && e.key === "ArrowRight") { stepBox(1); return; }
    if (e.altKey && e.key === "ArrowLeft") { stepBox(-1); return; }
    if (e.key === "Tab" && modalPanel) {
      var f = Array.prototype.filter.call(
        modalPanel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        function (el) { return el.offsetParent !== null; }
      );
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  if (modal) {
    modal.addEventListener("change", function (e) {
      var input = e.target;
      if (!input.matches || !input.matches("input[data-step-id]")) return;
      var id = input.getAttribute("data-step-id");
      if (input.checked) state[id] = true; else delete state[id];
      var step = input.closest(".step");
      if (step) step.classList.toggle("done", input.checked);
      saveState(); renderMeter(); renderBoxProgress();
    });
  }

  /* global copy delegation */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy-btn");
    if (!btn) return;
    e.preventDefault();
    var text = btn.getAttribute("data-copy");
    if (!text) {
      var code = btn.parentElement.querySelector("code");
      if (code) text = code.textContent;
    }
    if (!text) return;
    copyText(text).then(
      function () { flash(btn, "Copied ✓"); },
      function () { flash(btn, "Ctrl+C"); }
    );
  });

  /* ============================================================
     3. TOOLS BROWSER — list, detail panel, plain-language search
     ============================================================ */
  var TOOLS = [
    {
      cmd: "services.msc", name: "Services", topic: "Repair & logs", admin: false,
      what: "Lists every Windows service with its status and startup type, and lets you start, stop or restart one.",
      practice: "Print Spooler keeps stopping and jobs pile up in the queue. You restart the service here, set it back to Automatic, and watch that it stays running.",
      detail: "Run services.msc, find the service, and read Status and Startup type before changing anything. Restarting is a change: note what it was doing and confirm afterwards that it kept running.",
      keys: "service services restart start stop stuck background spooler printer print update audio bluetooth startup automatic status running stopped"
    },
    {
      cmd: "eventvwr.msc", name: "Event Viewer", topic: "Repair & logs", admin: false,
      what: "Shows system, application and security logs with the source, event ID and time of every error.",
      practice: "A user says the PC restarted overnight. You open Windows Logs > System, find the Kernel-Power error with the exact timestamp, and put it in the ticket.",
      detail: "Filter to Error and Critical for the last 24 hours. The source, event ID and time are the evidence second line asks for first — copy them rather than paraphrasing.",
      keys: "error errors log logs event crashes crash crashing viewer evidence code bsod bugcheck blue screen warning critical unexpected reboot restart restarting shutdown"
    },
    {
      cmd: "devmgmt.msc", name: "Device Manager", topic: "Devices & processes", admin: false,
      what: "Every device with its driver status; a warning icon points at a driver or hardware problem.",
      practice: "Sound stops after a Windows update. You find the audio device with a warning icon, roll the driver back, and the speakers work again.",
      detail: "View > Show hidden devices reveals hardware Windows can see but no longer uses. Try Roll Back Driver before uninstalling, and record the driver version in the ticket.",
      keys: "driver drivers device devices usb mouse keyboard sound audio speaker headphones camera webcam bluetooth monitor screen display yellow warning hardware unknown not working"
    },
    {
      cmd: "taskmgr", name: "Task Manager", topic: "Devices & processes", admin: false,
      what: "Startup apps, running processes, and a quick end-task when something hangs.",
      practice: "Windows takes four minutes to become usable. The Startup tab shows six apps launching at sign-in, and you disable the unnecessary ones with the user.",
      detail: "The Details tab gives the PID you need for taskkill. Ending a task loses unsaved work — warn the user before you do it.",
      keys: "task manager frozen not responding app application program close end task startup slow process kill crash crashing hang excel word teams chrome browser"
    },
    {
      cmd: "resmon", name: "Resource Monitor", topic: "Devices & processes", admin: false,
      what: "Live per-process view of CPU, memory, disk and network use.",
      practice: "\"It's slow\" becomes a fact: one process is reading the disk non-stop, and you can name it in the ticket instead of guessing.",
      detail: "Sort the Disk tab by Total (B/sec) to catch a thrashing drive, and the Overview tab by CPU for a runaway process. It is the fastest way to turn a vague complaint into evidence.",
      keys: "slow sluggish lag freezing freeze frozen performance cpu memory ram disk network process high usage hang busy"
    },
    {
      cmd: "taskkill", name: "End a process from CMD", topic: "Devices & processes", admin: true,
      what: "Ends a process by name or PID when Task Manager is not enough.",
      practice: "tasklist shows three stuck chrome.exe processes. You kill the specific PID instead of every Chrome window the user still has open.",
      detail: "Try closing the app normally first. /IM closes every matching process and can lose unsaved work, so prefer /PID with the number you got from tasklist.",
      keys: "kill process end task close frozen hang pid taskkill responding force"
    },
    {
      cmd: "ncpa.cpl", name: "Network Connections", topic: "Network & DNS", admin: false,
      what: "All network adapters with their status, and each adapter's IP settings.",
      practice: "Wi-Fi says connected but nothing loads. You disable and re-enable the adapter here, then check ipconfig /all for the address it actually received.",
      detail: "Adapter status shows speed and packet counts, so a disabled adapter looks different from a dead cable. Disabling an adapter drops the connection — not something to do mid-remote-session.",
      keys: "network wifi wireless ethernet adapter internet offline connection vpn lan connect disconnect dropping cable"
    },
    {
      cmd: "ipconfig /all", name: "IP configuration", topic: "Network & DNS", admin: false,
      what: "IP address, gateway, DNS servers and adapter details in one output.",
      practice: "A user cannot reach the file server. ipconfig /all shows 169.254.x.x, meaning no DHCP lease — so it is a network problem, not a permissions problem.",
      detail: "A 169.254 address proves DHCP failed. When the complaint is about names rather than connections, copy the DNS server lines into the ticket before changing anything.",
      keys: "ip address dns gateway network config ipconfig lease dhcp internet connection adapter"
    },
    {
      cmd: "ipconfig /flushdns", name: "Flush DNS cache", topic: "Network & DNS", admin: true,
      what: "Clears cached DNS answers when a name resolves to the wrong or stale place.",
      practice: "An intranet site moved last week and now opens for everyone except this laptop. Flushing the cache fixes it in one command.",
      detail: "It does not change the configured DNS server. If the wrong address comes back straight away, the DNS record itself is wrong and that is a different ticket.",
      keys: "dns cache flush website wrong site opening name resolution stale server not found"
    },
    {
      cmd: "net user", name: "Local account command", topic: "Accounts & policy", admin: true,
      what: "Lists local accounts and creates, resets, enables or deletes them.",
      practice: "A user is locked out of a workgroup PC. You reset the password, then check the account is not also disabled before telling them to try again.",
      detail: "Use * so the password is typed rather than stored in the command, and verify identity before any reset. /active:yes re-enables an account but does not clear a failed-sign-in lockout.",
      keys: "password reset account user locked lockout forgot forgotten login logon sign in create delete enable disable expired"
    },
    {
      cmd: "lusrmgr.msc", name: "Local Users and Groups", topic: "Accounts & policy", admin: false,
      what: "GUI for local accounts, group membership and account state (Pro / Enterprise).",
      practice: "You need to confirm a departed user's local account is disabled and no longer in Administrators — both visible in one window.",
      detail: "Home editions do not include this console; use net user and net localgroup there instead. The Administrators group name also differs on non-English installs.",
      keys: "user users account accounts group groups administrator local lockout disabled enable membership reset"
    },
    {
      cmd: "gpedit.msc", name: "Local Group Policy Editor", topic: "Accounts & policy", admin: false,
      what: "Opens the local policy tree where enforced settings live (Pro / Enterprise).",
      practice: "A setting resets itself after every sign-in. Policy is enforcing it, so you change it under Computer Configuration instead of the Settings app.",
      detail: "Run gpupdate /force after a change. Policy beats the Settings app — when the two disagree, policy is the one that wins.",
      keys: "policy group restrictions blocked greyed locked permission permissions admin control settings enforced"
    },
    {
      cmd: "sysdm.cpl", name: "System Properties", topic: "Accounts & policy", admin: true,
      what: "Computer name, domain or workgroup membership, and remote settings.",
      practice: "A PC will not join the domain. You check the current workgroup and whether Remote Desktop is allowed before troubleshooting anything else.",
      detail: "Renaming a PC or leaving a domain needs a restart and approval. Edition still decides domain join: Home cannot join at all.",
      keys: "domain join workgroup computer name rename remote desktop rdp properties ad active directory"
    },
    {
      cmd: "control printers", name: "Printers & Scanners", topic: "Printing", admin: false,
      what: "Printers, default printer, print queue and driver settings in one place.",
      practice: "Documents keep going to the wrong printer. The user's default is a retired device, so you set the right one and clear the queue.",
      detail: "Check the queue here before touching the spooler service — cancelling one stuck job is a lot smaller than clearing every job on the machine.",
      keys: "printer printers print printing printer not working queue stuck spooler paper toner scanner default missing offline wont print"
    },
    {
      cmd: "diskmgmt.msc", name: "Disk Management", topic: "Storage", admin: true,
      what: "Shows every disk and partition, and lets you assign a missing drive letter.",
      practice: "A USB drive appears in the BIOS but not in File Explorer. You give the volume a free letter and it turns up.",
      detail: "Never format or delete a volume without confirming the drive and the backup status. Partition work is a change, not a fix — record the approval.",
      keys: "disk drive letter partition volume usb storage missing showing space ssd hdd new unallocated"
    },
    {
      cmd: "cleanmgr", name: "Disk Cleanup", topic: "Storage", admin: false,
      what: "Finds temporary files, old updates and caches that can be deleted safely.",
      practice: "C: sits at 98% and the user keeps getting low-space warnings. Cleaning temp files and old update files frees several gigabytes without touching their work.",
      detail: "Use Clean up system files to reach previous installations and update leftovers. Stay out of the user's document folders — that is data, not clutter.",
      keys: "disk full space cleanup temp temporary files cache storage low free up clean"
    },
    {
      cmd: "chkdsk C: /scan", name: "Check Disk", topic: "Storage", admin: true,
      what: "Scans the file system for errors without needing a reboot.",
      practice: "A PC lost power and files now open as corrupt. The scan shows file-system errors before anything else is attempted.",
      detail: "Start with /scan; /f repairs and may need a restart, and /r checks for bad sectors over hours. If the drive may be failing, protect the data first.",
      keys: "disk check chkdsk file system error corruption bad sector scan drive failing errors"
    },
    {
      cmd: "msinfo32", name: "System Information", topic: "System & info", admin: false,
      what: "One page with the model, BIOS version, processor, installed RAM and OS build.",
      practice: "A warranty ticket needs the exact model and serial. System Summary gives you both without opening the case.",
      detail: "Paste the System Summary into the ticket. Component > Problem Devices lists hardware Windows already knows is not working.",
      keys: "system information specs specification model serial manufacturer ram memory processor cpu bios build version inventory asset warranty"
    },
    {
      cmd: "winver", name: "Windows Version", topic: "System & info", admin: false,
      what: "The exact Windows edition, version and build number.",
      practice: "A user asks for a feature their PC does not have. winver shows Home, which explains in seconds why it is missing.",
      detail: "The build number is the first thing support asks for on update and driver questions, so record it before you start changing things.",
      keys: "version edition build windows home pro enterprise feature missing about which update"
    },
    {
      cmd: "dxdiag", name: "DirectX Diagnostic", topic: "System & info", admin: false,
      what: "Reports GPU model, driver version, display output and sound devices.",
      practice: "A monitor flickers on one machine only. The Display tab shows an old GPU driver, which you update.",
      detail: "Save All Information writes a text report you can attach to the ticket instead of retyping driver versions by hand.",
      keys: "graphics gpu video display driver directx game gaming flicker flickering resolution sound audio render"
    },
    {
      cmd: "powercfg.cpl", name: "Power Options", topic: "System & info", admin: false,
      what: "Power plans, sleep, battery and lid behaviour for the machine.",
      practice: "A laptop shuts down on its own. Power Options shows an aggressive sleep timeout, and the battery report shows the real battery health.",
      detail: "powercfg /batteryreport writes an HTML report of capacity over time. If there is no power at all, test the adapter and treat it as hardware, not Windows.",
      keys: "power battery charging charger sleep hibernate wake shutdown turns turn on dead black screen laptop drain adapter"
    },
    {
      cmd: "sfc /scannow", name: "System File Checker", topic: "Repair & logs", admin: true,
      what: "Scans protected Windows files and tries to replace damaged copies.",
      practice: "Settings and Start stop opening after a bad shutdown. SFC repairs the corrupted system files and the shell behaves again.",
      detail: "Run it in an elevated prompt and read the closing line: \"successfully repaired\" and \"could not repair\" mean different things. If it cannot repair, run DISM first and then SFC again.",
      keys: "corrupt corruption system files repair scan bsod bugcheck blue screen crash restarting integrity damaged missing component broken windows error"
    },
    {
      cmd: "DISM /Online /Cleanup-Image /RestoreHealth", name: "Windows image repair", topic: "Repair & logs", admin: true,
      what: "Repairs the Windows component store; run it before SFC when corruption is suspected.",
      practice: "SFC keeps failing with the same error. DISM repairs the component store, and SFC then completes normally.",
      detail: "Needs an elevated prompt and can take 10–20 minutes; it may pull replacement files from Windows Update. Record the exit code in the ticket.",
      keys: "corruption corrupt component store image repair restore health sfc failed error 0x800f081f"
    },
    {
      cmd: "optionalfeatures", name: "Windows Features", topic: "Repair & logs", admin: true,
      what: "Turns optional Windows components on or off (.NET, Hyper-V, SMB, printing).",
      practice: "An old line-of-business app needs .NET Framework 3.5. The component is simply missing, so you enable it instead of reinstalling the app.",
      detail: "Enabling a feature is a software change: check whether policy manages it, and note the change in the ticket.",
      keys: "features optional component framework net hyperv smb install enable dotnet"
    },
    {
      cmd: "appwiz.cpl", name: "Programs and Features", topic: "Repair & logs", admin: false,
      what: "Installed software list with repair and uninstall options.",
      practice: "An app opens and immediately closes. Repair rebuilds the installation without losing the user's settings.",
      detail: "Uninstalling leaves app data behind in AppData, so check before telling a user something has been removed completely.",
      keys: "install uninstall program programs software app application remove repair installed broken"
    },
    {
      cmd: "cmd", name: "Command Prompt", topic: "Repair & logs", admin: true,
      what: "The prompt every command in this guide runs in; elevated for system changes.",
      practice: "You need net stop spooler, sfc or chkdsk. None of them work from an ordinary prompt — you need Run as administrator.",
      detail: "Right-click > Run as administrator; the title bar confirms elevation. A normal prompt silently fails on system commands, which is a very common false alarm.",
      keys: "command prompt cmd terminal elevated administrator shell console"
    },
    {
      cmd: "regedit", name: "Registry Editor", topic: "Repair & logs", admin: true,
      what: "Direct access to registry settings. Not a first-line tool.",
      practice: "A vendor documents a single key change. You export that key first, so the change can be undone if it does not help.",
      detail: "File > Export before touching anything. Never apply a registry tweak from an unverified forum post to a work machine.",
      keys: "registry regedit settings advanced edit backup key value tweak"
    }
  ];

  var TOPICS = ["System & info", "Devices & processes", "Network & DNS", "Accounts & policy", "Printing", "Storage", "Repair & logs"];

  /* synonym groups so everyday words reach the right tool */
  var GROUPS = [
    ["printer", "print", "printing", "prints", "queue", "spool", "spooler", "toner", "paper", "scan", "scanner"],
    ["slow", "sluggish", "lag", "laggy", "freeze", "freezing", "frozen", "hang", "hanging", "hangs", "performance", "cpu", "ram", "memory", "busy"],
    ["wifi", "wi", "fi", "wireless", "internet", "network", "offline", "disconnect", "disconnected", "dropping", "ethernet", "lan", "ip", "dns", "gateway", "connection", "connect", "vpn", "website", "browser"],
    ["password", "passcode", "login", "logon", "signin", "account", "user", "locked", "lockout", "forgot", "forgotten", "expired", "reset"],
    ["driver", "drivers", "device", "usb", "mouse", "keyboard", "sound", "audio", "speaker", "headphones", "camera", "webcam", "bluetooth", "monitor", "screen", "display", "flicker", "flickering", "blank"],
    ["disk", "drive", "space", "storage", "full", "partition", "volume", "letter", "ssd", "hdd", "chkdsk", "cleanup"],
    ["crash", "crashes", "crashing", "error", "errors", "bsod", "blue", "restart", "restarts", "reboot", "shutdown", "unexpected"],
    ["version", "edition", "build", "specs", "model", "serial", "inventory", "asset", "warranty"],
    ["policy", "group", "gpedit", "restriction", "restrictions", "blocked", "greyed", "permission", "permissions", "admin", "administrator", "enforced"],
    ["install", "uninstall", "program", "programs", "software", "app", "apps", "remove", "repair"],
    ["update", "updates", "patch", "upgrades"],
    ["boot", "startup", "power", "battery", "charging", "turns", "boots", "post"],
    ["corrupt", "corruption", "damaged", "broken", "integrity", "dism", "sfc"]
  ];

  var STOP = ["a", "an", "the", "i", "im", "my", "me", "is", "it", "its", "of", "to", "on", "in", "and", "or",
    "for", "with", "this", "that", "these", "not", "no", "am", "are", "was", "were", "be", "been", "do", "does",
    "did", "have", "has", "had", "cant", "cannot", "wont", "dont", "doesnt", "isnt", "please", "help", "need",
    "want", "get", "got", "how", "what", "why", "when", "where", "you", "we", "they", "he", "she", "there",
    "here", "just", "really", "very", "so", "too", "again", "keep", "keeps", "kept", "any", "some", "all",
    "out", "up", "down", "coming", "going", "makes", "make", "giving", "give", "says", "shown", "showing",
    "happens", "happening", "sometimes", "always", "still", "now", "then", "than", "much", "many", "like",
    "would", "could", "should", "working", "works", "wrong", "right", "problem", "problems", "issue", "issues",
    "pc", "computer", "laptop", "desktop", "machine", "windows", "win", "user", "users"];

  function norm(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  var INDEX = TOOLS.map(function (t) {
    var hay = norm(t.name + " " + t.cmd + " " + t.what + " " + t.practice + " " + t.detail + " " + t.topic + " " + t.keys);
    var keyHay = norm(t.keys);
    return { ref: t, hay: hay, keyHay: keyHay, keyWords: keyHay.split(" "), nameHay: norm(t.name + " " + t.cmd), words: hay.split(" ") };
  });

  var DF = {};
  INDEX.forEach(function (e) {
    var seen = {};
    e.keyWords.concat(e.words).forEach(function (w) {
      if (!w || seen[w]) return;
      seen[w] = 1;
      DF[w] = (DF[w] || 0) + 1;
    });
  });

  function idf(word) {
    var df = DF[word] || 0.5;
    return Math.log(1 + (INDEX.length / df));
  }

  function editDistance(a, b) {
    var m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 3;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[n];
  }

  function expandToken(token) {
    var out = [token];
    GROUPS.forEach(function (g) {
      if (g.indexOf(token) !== -1) {
        g.forEach(function (w) { if (out.indexOf(w) === -1) out.push(w); });
      }
    });
    return out;
  }

  function scoreEntry(entry, q, tokens) {
    var score = 0;
    if (q && q.length > 3 && entry.hay.indexOf(q) !== -1) score += 14;

    tokens.forEach(function (token) {
      if (token.length < 2) return;
      var best = 0;
      var expanded = expandToken(token);

      for (var i = 0; i < expanded.length; i++) {
        var term = expanded[i];
        var weight = idf(term);
        var value = 0;

        if (i === 0) {
          if (entry.keyWords.indexOf(term) !== -1) value = weight * 1.45;
          else if (entry.keyHay.indexOf(term) !== -1) value = weight * 0.85;
          else if (entry.words.indexOf(term) !== -1) value = weight * 0.55;
          else if (entry.hay.indexOf(term) !== -1) value = weight * 0.3;
          if (value > 0 && entry.nameHay.indexOf(term) !== -1) value += 1.8;
        } else {
          if (entry.keyWords.indexOf(term) !== -1) value = weight * 0.5;
          else if (entry.hay.indexOf(term) !== -1) value = weight * 0.18;
        }

        if (value > best) best = value;
      }

      if (!best && token.length >= 5) {
        var pool = entry.keyWords.concat(entry.words);
        var limit = token.length >= 7 ? 2 : 1;
        for (var j = 0; j < pool.length; j++) {
          if (Math.abs(token.length - pool[j].length) > limit) continue;
          if (editDistance(token, pool[j]) <= limit) {
            best = idf(pool[j]) * 0.8;
            if (entry.nameHay.indexOf(pool[j]) !== -1) best += 1.8;
            break;
          }
        }
      }

      score += best;
    });

    return score;
  }

  /* ---------- browser DOM ---------- */
  var listEl = document.getElementById("toolList");
  var detailEl = document.getElementById("toolDetail");
  var searchInput = document.getElementById("toolSearch");
  var topicSelect = document.getElementById("topicSelect");
  var clearBtn = document.getElementById("searchClear");
  var listEmpty = document.getElementById("listEmpty");

  var visible = TOOLS.map(function (t, i) { return i; });
  var selected = 0;

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function runLabel(tool) {
    var c = tool.cmd;
    return (/\.(msc|cpl)$/.test(c) || c.indexOf(" ") === -1) ? "Win + R" : "Command Prompt";
  }

  function fillTopics() {
    if (!topicSelect) return;
    TOPICS.forEach(function (t) {
      var o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      topicSelect.appendChild(o);
    });
  }

  function scoreAll(raw) {
    var q = norm(raw || "");
    var tokens = q ? q.split(" ").filter(function (t) { return STOP.indexOf(t) === -1; }) : [];
    if (!q) {
      return TOOLS.map(function (t, i) { return { i: i, s: 0 }; });
    }
    return INDEX.map(function (e, i) { return { i: i, s: scoreEntry(e, q, tokens) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });
  }

  function applyFilter(keepSelection) {
    var raw = searchInput ? searchInput.value : "";
    var topic = topicSelect ? topicSelect.value : "all";
    var scored = scoreAll(raw);

    visible = scored
      .filter(function (r) { return topic === "all" || TOOLS[r.i].topic === topic; })
      .map(function (r) { return r.i; });

    if (!keepSelection || visible.indexOf(selected) === -1) selected = visible.length ? visible[0] : -1;

    renderList();
    renderDetail();

    if (clearBtn) clearBtn.hidden = !raw;
    if (listEmpty) listEmpty.hidden = visible.length > 0;
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = visible.map(function (i, pos) {
      var t = TOOLS[i];
      return '<li>' +
        '<button class="browser-item' + (i === selected ? " active" : "") + '" type="button" data-tool="' + i + '">' +
          '<span class="bi-num">' + pad2(pos + 1) + '</span>' +
          '<span class="bi-name">' + esc(t.name) + '</span>' +
          '<span class="bi-arrow" aria-hidden="true">→</span>' +
        '</button>' +
      '</li>';
    }).join("");
  }

  function expRows(tool) {
    return '' +
      '<div class="exp-line"><span>Recognised as</span><b>' + esc(tool.name) + '</b></div>' +
      '<div class="exp-line"><span>Run from</span><b>' + runLabel(tool) + '</b></div>' +
      '<div class="exp-line"><span>Requires admin</span><b class="' + (tool.admin ? "" : "dim") + '">' + (tool.admin ? "Yes" : "No") + '</b></div>';
  }

  function renderDetail() {
    if (!detailEl) return;
    if (selected < 0) {
      detailEl.innerHTML = '<p class="browser-empty">No tool matches that. Try describing the symptom: “printer stuck”, “pc slow”, “forgot password”, “no internet”.</p>';
      return;
    }
    var t = TOOLS[selected];
    var pos = visible.indexOf(selected) + 1 || (TOOLS.indexOf(t) + 1);

    detailEl.innerHTML = '' +
      '<div class="detail-eyebrow">' +
        '<span class="de-num">' + pad2(pos) + '</span>' +
        '<span class="de-sep"></span>' +
        '<span class="de-topic">' + esc(t.topic) + '</span>' +
      '</div>' +
      '<h3 class="detail-title">' + esc(t.name) + '</h3>' +
      '<p class="detail-desc">' + esc(t.what) + '</p>' +

      '<div class="experiment">' +
        '<h4 class="exp-title">Try the command</h4>' +
        '<div class="exp-row">' +
          '<input class="exp-input" id="expInput" type="text" value="' + esc(t.cmd) + '" aria-label="Command to inspect" />' +
          '<button class="exp-btn" id="expBtn" type="button">Inspect</button>' +
        '</div>' +
        '<div class="exp-out" id="expOut">' + expRows(t) + '</div>' +
        '<div class="exp-foot">' +
          '<button class="copy-btn" type="button" data-copy="' + esc(t.cmd) + '">Copy command</button>' +
          '<span class="exp-note">Edit the box and press Inspect to check any command.</span>' +
        '</div>' +
      '</div>' +

      '<h4 class="section-h4">In practice</h4>' +
      '<p class="practice-text">' + esc(t.practice) + '</p>' +

      '<details class="tech">' +
        '<summary>Technical details and command</summary>' +
        '<div class="tech-body">' +
          '<p>' + esc(t.detail) + '</p>' +
          '<div class="code-block"><code>' + esc(t.cmd) + '</code>' +
            '<button class="copy-btn" type="button" data-copy="' + esc(t.cmd) + '">Copy</button>' +
          '</div>' +
        '</div>' +
      '</details>';
  }

  /* list clicks */
  if (listEl) {
    listEl.addEventListener("click", function (e) {
      var item = e.target.closest(".browser-item");
      if (!item) return;
      selected = parseInt(item.getAttribute("data-tool"), 10);
      renderList();
      renderDetail();
      if (window.innerWidth < 1000 && detailEl && detailEl.scrollIntoView) {
        detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  /* inspect */
  function runInspect() {
    var input = document.getElementById("expInput");
    var out = document.getElementById("expOut");
    if (!input || !out) return;

    var raw = input.value.trim();
    var q = norm(raw).replace(/\s+/g, "");
    var hit = null;

    if (raw) {
      for (var i = 0; i < TOOLS.length; i++) {
        if (norm(TOOLS[i].cmd).replace(/\s+/g, "") === q || norm(TOOLS[i].name).replace(/\s+/g, "") === q) {
          hit = TOOLS[i];
          break;
        }
      }
    }

    if (!raw) {
      out.innerHTML = '<div class="exp-line"><span>Enter a command or tool name</span><b class="dim">—</b></div>';
    } else if (hit) {
      out.innerHTML = expRows(hit);
    } else {
      out.innerHTML =
        '<div class="exp-line"><span>Not in this guide</span><b class="dim">search its symptom instead</b></div>' +
        '<div class="exp-line"><span>Checked for</span><b class="dim">' + esc(raw.slice(0, 40)) + '</b></div>';
    }
  }

  if (detailEl) {
    detailEl.addEventListener("click", function (e) {
      if (e.target.id === "expBtn") { e.preventDefault(); runInspect(); }
    });
    detailEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.id === "expInput") { e.preventDefault(); runInspect(); }
    });
  }

  if (searchInput) {
    var sTimer = null;
    searchInput.addEventListener("input", function () {
      window.clearTimeout(sTimer);
      sTimer = window.setTimeout(function () { applyFilter(false); }, 110);
    });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { searchInput.value = ""; applyFilter(false); }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!searchInput) return;
      searchInput.value = "";
      applyFilter(false);
      searchInput.focus();
    });
  }

  if (topicSelect) {
    topicSelect.addEventListener("change", function () { applyFilter(false); });
  }

  fillTopics();
  applyFilter(true);

  var ESC_ITEMS = [
    { key: "access", short: "needs access or a change outside L1 scope" },
    { key: "hardware", short: "possible hardware failure or data loss risk" },
    { key: "security", short: "security concern (malware, phishing, suspicious sign-in)" },
    { key: "critical", short: "multiple users or a critical system affected" },
    { key: "unresolved", short: "unresolved after the documented L1 steps" },
    { key: "blocked", short: "user is fully blocked from working" }
  ];

  /* ============================================================
     4. TICKET BUILDER
     ============================================================ */
  var fIssue = document.getElementById("fIssue");
  var fImpact = document.getElementById("fImpact");
  var fChecked = document.getElementById("fChecked");
  var fAction = document.getElementById("fAction");
  var fResult = document.getElementById("fResult");
  var fStatus = document.getElementById("fStatus");
  var fNext = document.getElementById("fNext");
  var notePreview = document.getElementById("notePreview");
  var noteStatus = document.getElementById("noteStatus");
  var copyNote = document.getElementById("copyNote");
  var clearNote = document.getElementById("clearNote");

  var escalated = false;
  var escSelected = {};

  function val(el, fallback) {
    var v = el && el.value ? el.value.trim() : "";
    return v || fallback;
  }

  function statusKind() {
    if (escalated) return { text: "Escalated", kind: "escalated", status: "Escalated" };
    var s = fStatus ? fStatus.value : "Resolved";
    if (s === "Resolved") return { text: "Resolved", kind: "resolved", status: s };
    if (s === "Escalated") return { text: "Escalated", kind: "escalated", status: s };
    if (s === "Monitoring") return { text: "Monitoring", kind: "pending", status: s };
    return { text: s, kind: "pending", status: s };
  }

  function escalationLines() {
    var reasons = ESC_ITEMS.filter(function (i) { return escSelected[i.key]; })
      .map(function (i) { return i.short; });
    if (!reasons.length) reasons.push("Standard L1 troubleshooting steps did not resolve the issue");

    var need = [];
    if (escSelected.access) need.push("higher access or a server-side change");
    if (escSelected.hardware) need.push("hardware diagnostics and replacement");
    if (escSelected.security) need.push("security team review");
    if (escSelected.critical) need.push("priority handling and wider communication");
    if (!need.length) need.push("second-line investigation");

    var urgency = (escSelected.security || escSelected.hardware || escSelected.critical) ? "High" : "Medium";

    return [
      "",
      "── ESCALATION → L2 ─────────────────",
      "Reason: " + reasons.join("; "),
      "Impact: " + val(fImpact, "(impact not recorded)"),
      "Already tried: " + val(fChecked, "(checks not recorded)"),
      "Action taken: " + val(fAction, "(no action recorded)"),
      "Result so far: " + val(fResult, "(no result recorded)"),
      "Need from L2: " + need.join(", "),
      "Urgency: " + urgency
    ];
  }

  function buildNote(plain) {
    var st = statusKind();
    var lines = [
      "Issue: " + val(fIssue, "(not recorded)"),
      "Impact: " + val(fImpact, "(not recorded)"),
      "Checked: " + val(fChecked, "(not recorded)"),
      "Action: " + val(fAction, "(not recorded)"),
      "Result: " + val(fResult, "(not recorded)"),
      "Status: " + st.status,
      "Next step: " + val(fNext, escalated ? "Assigned to L2." : "None.")
    ];

    var escLines = escalated ? escalationLines() : [];
    if (plain) return lines.concat(escLines).join("\n");
    return esc(lines.join("\n")) + (escalated ? '\n<span class="esc-block">' + esc(escLines.join("\n")) + "</span>" : "");
  }

  function renderNote() {
    if (notePreview) notePreview.innerHTML = buildNote(false);
    var st = statusKind();
    if (noteStatus) {
      noteStatus.textContent = st.text;
      noteStatus.setAttribute("data-status", st.kind);
    }
  }

  [fIssue, fChecked, fAction, fResult, fNext].forEach(function (el) {
    if (el) el.addEventListener("input", renderNote);
  });
  [fImpact, fStatus].forEach(function (el) {
    if (el) el.addEventListener("change", renderNote);
  });

  if (copyNote) {
    copyNote.addEventListener("click", function () {
      copyText(buildNote(true)).then(
        function () { flash(copyNote, "Note copied ✓"); },
        function () { flash(copyNote, "Press Ctrl+C"); }
      );
    });
  }

  if (clearNote) {
    clearNote.addEventListener("click", function () {
      [fIssue, fChecked, fAction, fResult, fNext].forEach(function (el) { if (el) el.value = ""; });
      escalated = false;
      renderNote();
    });
  }

  /* ============================================================
     5. ESCALATION HELPER
     ============================================================ */
  var verdictEl = document.getElementById("escVerdict");
  var verdictBadge = document.getElementById("verdictBadge");
  var verdictText = document.getElementById("verdictText");
  var verdictReasons = document.getElementById("verdictReasons");
  var escalateBtn = document.getElementById("escalateBtn");
  var removeEscalation = document.getElementById("removeEscalation");

  function renderVerdict() {
    var hard = ["access", "hardware", "security", "critical"].filter(function (k) { return escSelected[k]; });
    var soft = ["unresolved", "blocked"].filter(function (k) { return escSelected[k]; });
    var reasons = ESC_ITEMS.filter(function (i) { return escSelected[i.key]; }).map(function (i) { return i.short; });

    var level = "hold", badge = "KEEP AT L1", text = "";

    if (hard.length) {
      level = "escalate";
      badge = "ESCALATE → L2";
      text = "Yes — escalate. At least one condition is outside what L1 can safely do, so pass it up with the evidence you already have.";
    } else if (soft.length) {
      level = "consider";
      badge = "CONSIDER ESCALATING";
      text = "Finish the documented L1 steps and put the results in the note. If it still fails, escalate with that evidence rather than starting over.";
    } else {
      text = "Not yet. Keep working the documented L1 steps — check the box for each thing you rule out.";
    }

    if (verdictEl) verdictEl.setAttribute("data-level", level);
    if (verdictBadge) verdictBadge.textContent = badge;
    if (verdictText) verdictText.textContent = text;
    if (verdictReasons) {
      verdictReasons.innerHTML = reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    }
  }

  document.querySelectorAll("input[data-esc]").forEach(function (input) {
    input.addEventListener("change", function () {
      var key = input.getAttribute("data-esc");
      if (input.checked) escSelected[key] = true; else delete escSelected[key];
      renderVerdict();
      if (escalated) renderNote();
    });
  });

  if (escalateBtn) {
    escalateBtn.addEventListener("click", function () {
      escalated = true;
      if (fStatus) fStatus.value = "Escalated";
      renderNote();
      if (removeEscalation) removeEscalation.hidden = false;
      flash(escalateBtn, "Escalation added ✓");
      /* scroll the note into view on narrow screens */
      if (window.innerWidth < 1000 && notePreview && notePreview.scrollIntoView) {
        notePreview.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  if (removeEscalation) {
    removeEscalation.addEventListener("click", function () {
      escalated = false;
      if (fStatus) fStatus.value = "Resolved";
      removeEscalation.hidden = true;
      renderNote();
    });
  }

  /* ============================================================
     6. MISC UI — scroll progress, nav state, back to top
     ============================================================ */
  var progress = document.getElementById("progress");
  var toTop = document.getElementById("toTop");

  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    if (progress) progress.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0).toFixed(2) + "%";
    if (toTop) toTop.classList.toggle("show", doc.scrollTop > 420);

    /* nav highlight */
    var links = document.querySelectorAll(".nav-link");
    var current = "";
    document.querySelectorAll("main section[id]").forEach(function (s) {
      if (s.getBoundingClientRect().top <= 140) current = s.id;
    });
    Array.prototype.forEach.call(links, function (l) {
      l.classList.toggle("active", l.getAttribute("href") === "#" + current);
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  renderBoxProgress();
  renderNote();
  renderVerdict();
  onScroll();
})();
