/* TuxDesk: directory explorer, ticket playbooks, command reference.
   No dependencies. Works from file://. */

(function () {
  "use strict";

  /* ---------------- helpers ---------------- */

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "html") node.innerHTML = value; // static, authored strings only
        else if (key.indexOf("aria-") === 0 || key === "role") node.setAttribute(key, value);
        else if (key in node && key !== "list" && key !== "form") node[key] = value;
        else node.setAttribute(key, value);
      });
    }
    appendAll(node, children);
    return node;
  }

  function appendAll(node, children) {
    if (children === null || children === undefined) return;
    if (Array.isArray(children)) {
      children.forEach(function (child) { if (child) node.appendChild(child); });
    } else if (typeof children === "string") {
      node.appendChild(document.createTextNode(children));
    } else {
      node.appendChild(children);
    }
  }

  function code(text) { return el("code", { text: text }); }

  var copyAnnounce = el("p", { class: "visually-hidden", role: "status", "aria-live": "polite" });
  document.body.appendChild(copyAnnounce);

  function copyText(text, button) {
    function done(ok) {
      if (ok) {
        button.textContent = "Copied";
        button.dataset.state = "done";
        copyAnnounce.textContent = "Command copied to the clipboard.";
        window.setTimeout(function () {
          button.textContent = "Copy";
          delete button.dataset.state;
        }, 1800);
      } else {
        showCopyFallback(text, button);
      }
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(area);
    done(ok);
  }

  function showCopyFallback(text, button) {
    button.dataset.state = "failed";
    button.textContent = "Press Ctrl+C";
    var wrap = button.closest(".cmd");
    if (!wrap) return;
    var existing = wrap.querySelector(".copy-fallback");
    if (existing) existing.remove();
    var fallback = el("p", { class: "copy-fallback" }, [
      document.createTextNode("This browser blocked clipboard access. The command is selected below, so you can copy it manually: "),
      el("code", { text: text })
    ]);
    wrap.appendChild(fallback);
    var selection = window.getSelection();
    if (selection) {
      var range = document.createRange();
      range.selectNodeContents(fallback.querySelector("code"));
      selection.removeAllRanges();
      selection.addRange(range);
    }
    copyAnnounce.textContent = "Clipboard access was blocked. The command is shown for manual copying.";
    window.setTimeout(function () {
      if (button.dataset.state === "failed") {
        button.textContent = "Copy";
        delete button.dataset.state;
      }
    }, 4000);
  }

  /* split a command into tokens so wrapping happens at spaces, not inside paths */
  function commandTokens(text) {
    var parts = text.split(" ");
    var nodes = [];
    parts.forEach(function (part, i) {
      nodes.push(el("span", { text: part }));
      if (i < parts.length - 1) {
        nodes.push(document.createTextNode(" "));
        nodes.push(el("wbr"));
      }
    });
    return nodes;
  }

  function cmdBlock(text, note) {
    var box = el("div", { class: "cmd" });
    var bar = el("div", { class: "cmd-bar" }, [
      el("span", { class: "prompt", "aria-hidden": "true", text: "$" }),
      el("code", { class: "cmd-text" }, commandTokens(text))
    ]);
    var button = el("button", { type: "button", class: "copy-btn", text: "Copy" });
    button.setAttribute("aria-label", "Copy command: " + text);
    button.addEventListener("click", function () { copyText(text, button); });
    bar.appendChild(button);
    box.appendChild(bar);
    if (note) {
      box.appendChild(el("p", { class: "cmd-note", text: note }));
    }
    return box;
  }

  /* ---------------- directory data ---------------- */

  var DIRECTORIES = [
    {
      path: "/",
      tag: "root of the tree",
      desc: "The top of the filesystem hierarchy. Every path resolves back to it, and every mounted filesystem hangs somewhere below it.",
      use: "Before you assume a path is on the disk you are looking at, find which filesystem holds it with findmnt -T, then check that filesystem's capacity and inodes with df.",
      cmd: "findmnt -T /var/log && df -h /var/log",
      caution: "A full root filesystem affects logging, package installs, and logins at once. Freeing space here is a change to production; get approval before deleting anything.",
      flag: "Sensitive"
    },
    {
      path: "/bin",
      tag: "essential commands",
      desc: "Essential user commands that must be available when the system boots or is in single-user mode, such as ls, cp, cat, and bash.",
      use: "When a user reports 'command not found' for something basic, check the binary exists and whether /bin is a symlink into /usr, which tells you how the distribution is laid out.",
      cmd: "ls -ld /bin && ls /bin | head",
      caution: "On merged-/usr systems /bin is a symlink to /usr/bin. Replacing or removing files here can make the system unbootable. Use the package manager to change packaged binaries."
    },
    {
      path: "/boot",
      tag: "boot loader and kernel",
      desc: "Kernel images, initramfs files, and boot loader configuration. Often a separate, deliberately small partition.",
      use: "A kernel update can fail on a full /boot. Check free space here before approving updates, and list installed kernels before removing any.",
      cmd: "df -h /boot && ls -lh /boot",
      caution: "Do not delete kernel or initramfs files by hand to free space. Remove old kernels with the package manager (apt autoremove on Debian-family, dnf remove on the RHEL family) so the boot loader config stays consistent.",
      flag: "Sensitive"
    },
    {
      path: "/dev",
      tag: "device nodes",
      desc: "Device files the kernel exposes: disks, partitions, terminals, pseudo-terminals, and character devices.",
      use: "Identify the correct device name before any storage work. lsblk and findmnt show names, sizes, and mount points together, which is safer than guessing between /dev/sdb and /dev/sdc.",
      cmd: "lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT",
      caution: "Writing to a block device node overwrites the filesystem on it. Confirm the device by serial or model, not by letter, and check the mount table first.",
      flag: "Sensitive"
    },
    {
      path: "/etc",
      tag: "host configuration",
      desc: "Configuration files for the host: network, services, users, mounts, and package sources. Mostly plain text.",
      use: "Read configuration before changing it: check fstab entries, sshd settings, sudoers, and repository definitions. grep with -v '^#' strips comment lines so the active settings are visible.",
      cmd: "grep -v '^[[:space:]]*#' /etc/fstab",
      caution: "There is no single safe edit here. Take a copy of the file first, change one setting at a time, and edit sudoers only with visudo. Configuration may be managed centrally, so local edits can be overwritten.",
      flag: "Sensitive"
    },
    {
      path: "/home",
      tag: "user data",
      desc: "Home directories for ordinary users, typically /home/<user>, holding documents, application settings, and session files.",
      use: "For space or permission tickets, measure the user's directory before touching it, and check ownership of hidden files after a restore or a careless sudo session.",
      cmd: "du -sh /home/<user> 2>/dev/null; ls -ld /home/<user>",
      note: "Reading another user's home normally requires sudo, and should follow your data-access policy.",
      caution: "This is user data. Do not delete files to free space without the user's agreement, and note that some home directories are encrypted or network-mounted.",
      flag: "Sensitive"
    },
    {
      path: "/lib",
      tag: "shared libraries and modules",
      desc: "Shared libraries needed by the binaries in /bin and /sbin, plus kernel modules under /lib/modules.",
      use: "A missing shared object error points here. Check whether the library is present and whether the path is a symlink into /usr/lib before reinstalling anything.",
      cmd: "ldconfig -p | grep -i libssl",
      caution: "Library directories are usually symlinks into /usr/lib on modern systems. Do not copy libraries in by hand; use the package manager so version and ABI stay consistent.",
      flag: "Sensitive"
    },
    {
      path: "/lib64",
      tag: "64-bit libraries",
      desc: "64-bit shared libraries on systems that keep them separate from /lib. On merged-/usr systems this is a symlink to /usr/lib64.",
      use: "Present on many x86_64 systems and sometimes missing on others. Check whether it exists before writing a script that refers to it, since portable scripts should not assume either layout.",
      cmd: "ls -ld /lib64",
      caution: "Do not create or remove this path to make an installer happy. If a vendor package expects a layout your distribution does not use, that is a compatibility question for the vendor.",
      flag: "Sensitive"
    },
    {
      path: "/media",
      tag: "removable media",
      desc: "Mount points created automatically for removable media such as USB drives and inserted discs, usually a directory per device or label.",
      use: "Before telling a user to unplug a USB drive, find its mount point and confirm nothing is writing to it.",
      cmd: "findmnt -T /media && lsblk",
      caution: "Removing media without unmounting can truncate a file being written. Use umount (or the desktop's eject) and check for open files with lsof if the unmount is refused."
    },
    {
      path: "/mnt",
      tag: "temporary mounts",
      desc: "A conventional place for temporary or manually managed mounts, chosen by the administrator. Nothing is mounted here by default on most systems.",
      use: "Mount into a named subdirectory such as /mnt/rescue, so the mount is obvious in the mount table and easy to clean up.",
      cmd: "findmnt -T /mnt; findmnt -rn -o TARGET,SOURCE,FSTYPE | grep '^/mnt'",
      caution: "Only unmount after checking that no process is using the mount. Mounting over a directory that already has files hides them until the unmount."
    },
    {
      path: "/opt",
      tag: "add-on software",
      desc: "Optional, self-contained software packages from a vendor, separate from distribution packages, each in its own directory.",
      use: "When a vendor application behaves oddly or a binary is found in an unexpected place, check /opt and whether its bin directory was added to PATH.",
      cmd: "ls -l /opt; echo \"$PATH\"",
      caution: "Content here is usually outside the package manager, so upgrades and removals are manual. Record what you install and how it was installed."
    },
    {
      path: "/proc",
      tag: "virtual, kernel-generated",
      desc: "A virtual filesystem exposing kernel and process information. Files exist only in memory and are generated on access.",
      use: "Read process command lines, memory totals, and per-process limits without extra tools. It also shows deleted-but-open file descriptors through the process file descriptors directory.",
      cmd: "cat /proc/meminfo | head -n 5; cat /proc/<pid>/cmdline | tr '\\0' ' '",
      caution: "Virtual: files here take no disk space, and deleting them is meaningless. Some writable entries change kernel behaviour. Prefer the documented tools (ps, free, sysctl) over editing /proc directly.",
      flag: "Virtual"
    },
    {
      path: "/root",
      tag: "root user's home",
      desc: "The home directory of the root account, normally readable only by root (mode 0700). It is not the filesystem root.",
      use: "Root's crontab, scripts, and shell history often live here, which explains why a backup that runs as root finds files an ordinary user cannot see.",
      cmd: "sudo ls -la /root",
      note: "Requires elevated privileges and a reason. Do not leave other users' files here.",
      caution: "Confusing /root with / is a common and destructive mistake: rm -rf /root is not rm -rf /, but both are dangerous if you are unsure which you mean. Check pwd before destructive commands.",
      flag: "Sensitive"
    },
    {
      path: "/run",
      tag: "runtime state",
      desc: "Volatile runtime data created since boot: process ID files, sockets, lock files, and service state. Usually a tmpfs, so it is emptied on reboot.",
      use: "Explains why a stale PID or lock file disappears after a reboot, and where to look when a service says it is already running.",
      cmd: "ls -l /run/*.pid 2>/dev/null; find /run -maxdepth 1 -type d | head",
      caution: "Volatile by design. Do not store data here expecting it to survive a restart, and do not remove another service's runtime files while it is running.",
      flag: "Virtual"
    },
    {
      path: "/sbin",
      tag: "system administration commands",
      desc: "System administration binaries used mainly by root, such as mount, fsck, and networking tools. Merged into /usr/sbin on most current systems.",
      use: "A user reporting 'command not found' for ip, ss, or ifconfig is often hitting a PATH that excludes /sbin. Check PATH as well as the package.",
      cmd: "ls -ld /sbin; command -v ip; echo \"$PATH\"",
      caution: "Administrative binaries can change system state. Confirm the command's effect and that you are on the right host before running it."
    },
    {
      path: "/srv",
      tag: "service data",
      desc: "Data served by services on this host, such as web or file-transfer content. The FHS leaves the internal layout to the administrator.",
      use: "When a site or share's content is not where documentation claims, check the service's own configuration before assuming /var/www or /srv.",
      cmd: "ls -l /srv; grep -R \"DocumentRoot\\|root \" /etc/nginx /etc/apache2 2>/dev/null",
      caution: "Layouts vary widely and may be distribution-specific. Read the service configuration; the directory name alone will not tell you where content lives."
    },
    {
      path: "/sys",
      tag: "virtual, device and kernel state",
      desc: "A virtual filesystem that exposes kernel objects and device attributes: network link state, power settings, hardware topology.",
      use: "Useful for read-only checks such as whether a network interface is up at the link level, or what driver a device is using.",
      cmd: "cat /sys/class/net/*/operstate",
      caution: "Virtual, and some entries are writable and change hardware or kernel behaviour. Treat writes as privileged changes, not inspection.",
      flag: "Virtual"
    },
    {
      path: "/tmp",
      tag: "temporary files",
      desc: "A world-writable directory for temporary files. Often a tmpfs, and commonly cleaned at boot or by a periodic cleanup service.",
      use: "Installers, sockets, and session files land here. On a space ticket, check whether /tmp is on its own filesystem before blaming the root volume.",
      cmd: "df -h /tmp; find /tmp -maxdepth 1 -user <user> -mtime +1 | head",
      caution: "Do not clear /tmp while users are logged in or services are running; active sockets and lock files live here. Old files are not automatically junk.",
      flag: "Sensitive"
    },
    {
      path: "/usr",
      tag: "installed software",
      desc: "The bulk of installed software: /usr/bin for user commands, /usr/lib for libraries, /usr/share for architecture-independent data such as documentation, and /usr/local for local installs.",
      use: "Most 'which binary is actually running' questions are answered here, especially when /usr/local/bin precedes /usr/bin in PATH.",
      cmd: "ls /usr; command -v python3; type -a python3",
      caution: "Usually treated as read-only on modern systems so it can be shared or snapshotted. Install software through the package manager so versions stay consistent with the host."
    },
    {
      path: "/var",
      tag: "variable data",
      desc: "Data that changes while the system runs: logs, mail and print queues, package caches, databases under /var/lib, and web content under /var/www.",
      use: "Most 'disk full' tickets end here. Measure the top-level consumers first, then descend. Deleting from whichever directory looks large is how services break.",
      cmd: "sudo du -xh --max-depth=1 /var 2>/dev/null | sort -h | tail -n 10",
      note: "Reading other services' data needs elevated privileges and a reason.",
      caution: "Do not delete from /var/lib: it holds application state, including databases. Package caches can be cleared with the package manager's own clean command, with approval.",
      flag: "Sensitive"
    },
    {
      path: "/var/log",
      tag: "logs",
      desc: "Log files for the system and services. Some hosts write traditional text logs here; others keep logs only in the systemd journal, or ship them to a central collector.",
      use: "First stop for a failure timestamp: list the directory for recently modified files, then read only the window around the incident.",
      cmd: "sudo journalctl --since \"1 hour ago\" --no-pager | tail -n 40",
      note: "Reading logs usually needs elevated privileges on multi-user hosts.",
      caution: "Do not delete logs to free space, and do not assume a record exists: logging is configured per host. Some logs contain personal or authentication data, so handle and share them per policy.",
      flag: "Sensitive"
    },
    {
      path: "/usr/local",
      tag: "local installs",
      desc: "Software installed by the administrator outside the distribution's packages, conventionally with /usr/local/bin for commands and /usr/local/etc for configuration.",
      use: "When the version a user runs differs from the packaged one, compare precedence: /usr/local/bin usually comes before /usr/bin in PATH.",
      cmd: "ls -l /usr/local/bin | head; echo \"$PATH\"",
      caution: "Not managed by the package manager, so updates and removals are manual. Write down what you install, where it came from, and how to remove it."
    }
  ];

  /* ---------------- directory explorer ---------------- */

  var dirListEl = document.getElementById("dir-list");
  var dirDetailEl = document.getElementById("dir-detail");
  var dirSearchEl = document.getElementById("dir-search");
  var dirEmptyEl = document.getElementById("dir-empty");
  var dirStatusEl = document.getElementById("dir-status");
  var dirClearEl = document.getElementById("dir-clear");

  var visibleDirs = [];
  var activeIndex = 0;
  var dirButtons = [];

  function dirHaystack(entry) {
    return (entry.path + " " + entry.tag + " " + entry.desc + " " + entry.use + " " + entry.caution).toLowerCase();
  }

  function renderDirList() {
    dirListEl.textContent = "";
    dirButtons = [];
    visibleDirs.forEach(function (entry, i) {
      var button = el("button", {
        type: "button",
        class: "dir-btn",
        "aria-pressed": "false"
      }, [
        el("span", { class: "dir-index", text: String(i + 1).padStart(2, "0") }),
        el("span", { class: "dir-path", text: entry.path }),
        el("span", { class: "dir-arrow", "aria-hidden": "true", text: "→" })
      ]);
      button.dataset.path = entry.path;
      button.addEventListener("click", function () {
        selectDir(i, false);
        if (window.matchMedia("(max-width: 900px)").matches) {
          var smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
          dirDetailEl.scrollIntoView({ behavior: smooth, block: "start" });
        }
      });
      var li = el("li", { class: "dir-item" }, button);
      dirListEl.appendChild(li);
      dirButtons.push(button);
    });
  }

  function selectDir(index, moveFocus) {
    if (!visibleDirs.length) return;
    activeIndex = Math.max(0, Math.min(index, visibleDirs.length - 1));
    dirButtons.forEach(function (button, i) {
      var isActive = i === activeIndex;
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.dataset.active = isActive ? "true" : "false";
    });
    renderDirDetail(visibleDirs[activeIndex]);
    if (moveFocus) {
      dirButtons[activeIndex].focus();
      dirButtons[activeIndex].scrollIntoView({ block: "nearest" });
    }
  }

  function renderDirDetail(entry) {
    dirDetailEl.textContent = "";
    var kicker = el("p", { class: "detail-kicker" }, [
      el("span", { class: "tag", text: entry.tag }),
      el("span", { text: entry.flag ? entry.flag : "Read-only checks recommended" })
    ]);
    dirDetailEl.appendChild(kicker);
    dirDetailEl.appendChild(el("h3", { text: entry.path }));
    dirDetailEl.appendChild(el("p", { class: "detail-desc", text: entry.desc }));

    var use = el("div", { class: "detail-block" }, [
      el("h4", { text: "In support" }),
      el("p", { text: entry.use })
    ]);
    dirDetailEl.appendChild(use);

    if (entry.cmd) {
      var cmdWrap = el("div", { class: "detail-block" }, [el("h4", { text: "Safe example" })]);
      cmdWrap.appendChild(cmdBlock(entry.cmd, entry.note));
      dirDetailEl.appendChild(cmdWrap);
    }

    if (entry.caution) {
      dirDetailEl.appendChild(el("div", { class: "detail-caution" }, [
        el("span", { class: "caution-mark", "aria-hidden": "true", text: "!" }),
        el("div", {}, [
          el("span", { class: "detail-flag", text: entry.flag || "Caution" }),
          el("p", { text: entry.caution })
        ])
      ]));
    }
  }

  function filterDirs() {
    var query = dirSearchEl.value.trim().toLowerCase();
    var previousPath = visibleDirs[activeIndex] ? visibleDirs[activeIndex].path : null;

    visibleDirs = DIRECTORIES.filter(function (entry) {
      if (!query) return true;
      return dirHaystack(entry).indexOf(query) !== -1;
    });

    renderDirList();

    if (!visibleDirs.length) {
      dirEmptyEl.hidden = false;
      dirDetailEl.textContent = "";
      dirDetailEl.appendChild(el("div", { class: "detail-block" }, [
        el("h4", { text: "No match" })
      ]));
      dirDetailEl.appendChild(el("p", { class: "detail-desc", text: "Nothing in the list matches that search. Clear it, or try a shorter term such as log, var, or mount." }));
      dirStatusEl.textContent = "No matches for \u201c" + dirSearchEl.value.trim() + "\u201d.";
      return;
    }

    dirEmptyEl.hidden = true;
    var keep = visibleDirs.findIndex(function (entry) { return entry.path === previousPath; });
    selectDir(keep >= 0 ? keep : 0, false);
    dirStatusEl.textContent = query
      ? visibleDirs.length + " of " + DIRECTORIES.length + " directories match."
      : DIRECTORIES.length + " directories listed.";
  }

  function onDirKeydown(event) {
    var keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (keys.indexOf(event.key) === -1) return;
    if (!dirButtons.length) return;
    event.preventDefault();
    if (event.key === "ArrowDown") selectDir(activeIndex + 1, true);
    else if (event.key === "ArrowUp") selectDir(Math.max(0, activeIndex - 1), true);
    else if (event.key === "Home") selectDir(0, true);
    else if (event.key === "End") selectDir(dirButtons.length - 1, true);
  }

  dirListEl.addEventListener("keydown", onDirKeydown);
  dirSearchEl.addEventListener("input", filterDirs);
  dirSearchEl.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown" && dirButtons.length) {
      event.preventDefault();
      selectDir(activeIndex, true);
    }
  });
  dirClearEl.addEventListener("click", function () {
    dirSearchEl.value = "";
    filterDirs();
    dirSearchEl.focus();
  });

  filterDirs();
  selectDir(0, false);

  /* ---------------- ticket data ---------------- */

  var TICKETS = [
    {
      id: "disk",
      full: "Writes fail with No space left on device, applications crash, or the desktop returns to the login screen after a correct password.",
      num: "01",
      title: "Disk full, “no space left”, or a login loop",
      symptom: "No space left on device, crashing apps, or the login screen returns after a correct password.",
      triage: "Check capacity and inodes on the filesystem that holds the failing path.",
      causes: [
        "One filesystem is out of data blocks: commonly /, /var, /home, or /boot.",
        "Inodes are exhausted while free space still shows: many small files, mail queues, or session directories.",
        "Space is held by deleted files that a process still has open.",
        "A log or journal has grown beyond its configured limit or rotation has stopped working.",
        "User quota reached, which shows up as a write failure rather than a full filesystem.",
        "Login loop with space available has other causes: session or profile ownership, a full /home, display manager configuration, or an authentication stack problem."
      ],
      steps: [
        { tag: "Scope", text: "Confirm the host, which users are affected, and whether the affected path is on a shared or network filesystem. Note whether every write fails or only one application's." },
        { tag: "Diagnose", text: "Record the exact error text and the path it names. That path determines which filesystem you need to inspect.", cmd: "df -hT; df -i" },
        { tag: "Diagnose", text: "If a filesystem shows high IUse% with free blocks, you have an inode problem, not a capacity problem. Find where the file count sits before deleting anything.", cmd: "sudo du -x --inodes -d 2 /var 2>/dev/null | sort -n | tail -n 10" },
        { tag: "Diagnose", text: "Measure the biggest directories on the affected filesystem. Read the output before acting; a large directory is not automatically disposable.", cmd: "sudo du -xh --max-depth=1 / 2>/dev/null | sort -h | tail -n 15" },
        { tag: "Diagnose", text: "Check for deleted-but-open files. These hold space until the owning process closes them or is restarted.", cmd: "sudo lsof +L1 2>/dev/null | head -n 20" },
        { tag: "Decision", text: "Choose the fix that matches the cause: rotate or vacuum logs within policy, clear the package cache with the package manager, restart the service holding deleted files, or escalate for quota or capacity. Do not delete logs, user data, or caches to make df look better." },
        { tag: "Fix", text: "Reduce journal size within the agreed retention limit. This is a change to log retention, so confirm the limit first (Debian-family and RHEL-family both use systemd here).", cmd: "sudo journalctl --vacuum-size=200M" },
        { tag: "Fix", text: "Clear cached package downloads only, not installed software. Debian-family first, then the RHEL-family equivalent, if that is the system in front of you.", cmd: "sudo apt-get clean", note: "RHEL family: sudo dnf clean packages. Both remove cached package files; neither removes installed packages." },
        { tag: "Branch", text: "For a login loop with free space: sign in on a text console, check that the user owns their session files, and look at the display manager and authentication logs for the actual failure.", cmd: "ls -ld /home/<user>/.Xauthority /home/<user>/.config 2>/dev/null; sudo journalctl -b -u gdm -n 40 --no-pager" },
        { tag: "Verify", text: "Confirm capacity and inode use are back under the threshold, then have the user save a test file and complete a full log out and log in." },
        { tag: "Document", text: "Record what filled the filesystem, what you removed, and whether the growth pattern needs a monitoring or retention change. Recurrence is a sign the underlying cause is still present." }
      ],
      decisions: [
        { cond: "If the same filesystem fills again within a day", text: "Something is writing continuously, often a failing service or a debug setting left on. Escalate to the application owner instead of repeating the cleanup." },
        { cond: "If free blocks are fine but inodes are exhausted", text: "Find the directory holding the file count. Common culprits are mail queues, session directories, and /tmp. Confirm what is safe to remove with the service owner." },
        { cond: "If space is held by deleted files", text: "Restart the specific service that holds them, in an approved window, or accept the space will return when it exits. A reboot is a last resort, not a first step." },
        { cond: "If the login loop persists with space available", text: "This is now a session or authentication symptom. Preserve the failing logs and escalate to the desktop or identity team; do not keep deleting files." }
      ],
      verify: [
        "df -h and df -i show the affected filesystem below its threshold.",
        "The user saves a file in the location that failed and opens it again.",
        "The user logs out and back in successfully, if a login loop was reported."
      ],
      document: "Note the filesystem, the cause, the exact cleanup or change, the approval reference, and the resulting figures.",
      dist: "Debian/Ubuntu and the RHEL family both use systemd's journal and /var/log. Package cache commands differ: apt-get clean versus dnf clean packages. Log file names differ too: /var/log/syslog versus /var/log/messages."
    },
    {
      id: "perms",
      full: "The user cannot open, edit, or execute a file after a restore, a copy, or a move. Sometimes the error appears on a script that worked yesterday.",
      num: "02",
      title: "Permission denied, inaccessible restored files, or a script that will not run",
      symptom: "A file cannot be opened or run after a restore or copy. Scripts that worked yesterday now fail.",
      triage: "Read the file mode, then the parent directories, then the mount options.",
      causes: [
        "Mode bits changed during a copy or restore, for example through a filesystem that has no Unix permissions such as FAT/exFAT.",
        "Ownership changed because the restore produced numeric user IDs that do not exist on this host.",
        "A parent directory is missing execute permission, so the path cannot be traversed even when the file itself is readable.",
        "An ACL grants or denies access in a way that plain ls does not show.",
        "A security label is wrong, typically after files were moved instead of copied on an SELinux host.",
        "The filesystem was mounted noexec, nosuid, or read-only, so permissions are not the whole story.",
        "For scripts: no shebang, no execute bit, or Windows line endings."
      ],
      steps: [
        { tag: "Scope", text: "Establish which file, which user, and what changed recently: a restore, a migration, an unzip, a copy from a USB stick, or a git checkout." },
        { tag: "Diagnose", text: "Check permissions and ownership for the file and every directory in its path. This is the single most useful check for permission tickets.", cmd: "namei -l /path/to/file" },
        { tag: "Diagnose", text: "Identify your own identity and the file's owner, group, mode, and ACL entries.", cmd: "id; stat -c '%U %G %a %n' /path/to/file; getfacl /path/to/file 2>/dev/null" },
        { tag: "Diagnose", text: "Check how the path is mounted. If the filesystem is FAT/exFAT, it has no Unix permissions; if it is mounted noexec, nothing on it will run.", cmd: "findmnt -T /path/to/file -o TARGET,SOURCE,FSTYPE,OPTIONS" },
        { tag: "Diagnose", text: "For a script, look at the first line and the line endings. A carriage return after the shebang produces a confusing interpreter-not-found error.", cmd: "head -n 1 ./script.sh; file ./script.sh; cat -A ./script.sh | head -n 3" },
        { tag: "Decision", text: "Match the fix to the cause and nothing more: add the execute bit to your own script, correct ownership of the specific path, strip Windows line endings on a copy, restore a security label, or move the file off a noexec mount. Avoid recursive ownership or permission changes on a home directory or project tree." },
        { tag: "Fix", text: "Add execute permission to a single script you have inspected. The same command works on Debian-family and RHEL-family systems.", cmd: "chmod u+x ./script.sh" },
        { tag: "Fix", text: "On an SELinux host, read the label and restore the correct context for that path. Do not disable SELinux or set it permissive to make a warning go away.", cmd: "ls -Z /path/to/file; sudo restorecon -Rv /path/to/file", note: "SELinux is enabled by default on the RHEL family; many Debian/Ubuntu hosts do not install it." },
        { tag: "Verify", text: "Test as the affected user in their own session, then have them retry the exact action that failed.", cmd: "sudo -u <user> ls -l /path/to/file" },
        { tag: "Document", text: "Record the before and after modes and ownership, the reason for the change, and whether the restore tool needs a different option next time." }
      ],
      decisions: [
        { cond: "If the restore produced numeric owners", text: "Map the old IDs to the new accounts deliberately. Changing ownership across an entire home directory to 'fix' one file gives the wrong access to everything else." },
        { cond: "If the mode looks correct but access still fails", text: "Work outward: parent directory permissions, ACLs, security labels, mount options, and finally read-only mounts. The failing layer is usually the one you have not checked." },
        { cond: "If a service cannot read its files", text: "Check the service's own user in its unit file. Testing as your shell user proves nothing about the service account." },
        { cond: "If the file is on noexec media", text: "Copy it to a suitable location or remount with approval. Never chmod 777 and never copy an executable from untrusted media and run it as root." }
      ],
      verify: [
        "The affected user can perform the action that failed, tested in their own session.",
        "The script runs from its normal location with its intended interpreter.",
        "Permissions on other paths in the same tree are unchanged."
      ],
      document: "Note the original mode and owner, the new mode and owner, and why the change was limited to that path.",
      dist: "SELinux tooling (ls -Z, restorecon, getenforce) is standard on the RHEL family and AppArmor is common on Ubuntu. Filesystem defaults for home directories and mount options differ between distributions and installers, so read findmnt."
    },
    {
      id: "frozen",
      full: "An application stops responding, the desktop becomes sluggish, or a monitoring check reports sustained CPU or memory use on a host.",
      num: "03",
      title: "Frozen application or high CPU and memory use",
      symptom: "An application hangs, the desktop lags, or a host is pinned at high CPU or memory.",
      triage: "Warn about unsaved work, then check the process and its state.",
      causes: [
        "The application is waiting on a blocked resource: a full disk, an unresponsive network mount, or a database lock.",
        "A runaway loop, or a legitimate batch task that is using resources as designed.",
        "Memory pressure, swapping, or the kernel's out-of-memory killer terminating a process.",
        "A crashed or hung graphics session rather than a single application.",
        "Storage or network I/O saturation, which shows as high load with low CPU use."
      ],
      steps: [
        { tag: "Scope", text: "Tell the user what you are about to do and ask them to save what they can. Force-terminating a process discards unsaved work. Confirm whether the whole machine is affected or one application." },
        { tag: "Diagnose", text: "Identify the top CPU and memory consumers with process state, age, and parent. A state of D means uninterruptible sleep, usually waiting on I/O.", cmd: "ps -eo pid,ppid,user,stat,%cpu,%mem,etime,cmd --sort=-%cpu | head -n 12" },
        { tag: "Diagnose", text: "Check overall memory and swap pressure, and load average, before deciding whether this is one process or the host.", cmd: "free -h; uptime" },
        { tag: "Diagnose", text: "If the host is reachable, read the kernel log for out-of-memory events and the service log for the failure that preceded the hang.", cmd: "sudo journalctl -k --since today --no-pager | grep -i -E 'out of memory|oom-kill|killed process'" },
        { tag: "Diagnose", text: "If the process is in D state, or the disk is busy, suspect storage first. Check I/O wait and any network mounts before killing anything, since a killed process still cannot exit.", cmd: "top -bn1 | head -n 5; findmnt -t nfs,nfs4,cifs" },
        { tag: "Decision", text: "Try to close the application normally, then send SIGTERM and give it time to shut down. Only escalate to SIGKILL after confirming the PID, the user, and that you have authorization, understanding that unsaved data will be lost." },
        { tag: "Fix", text: "Ask the application to terminate cleanly, then verify it has exited before considering anything stronger.", cmd: "kill -TERM <pid>; sleep 5; ps -p <pid> -o pid,stat,cmd" },
        { tag: "Fix", text: "Only when TERM has failed, the PID is confirmed, and the user accepts the loss of unsaved work, force the process to end. Document the reason.", cmd: "kill -KILL <pid>", note: "SIGKILL cannot be caught, so the application gets no chance to clean up. Prefer stopping the parent session or restarting the specific systemd unit if the process belongs to a service." },
        { tag: "Verify", text: "Confirm memory and load return to normal, the application starts again, and the user's file is intact. Clear any stale lock file the application left behind, if it documents one." },
        { tag: "Document", text: "Record the process name, PID, signal used, time, and outcome, plus whether the trigger was storage, memory, or the application itself." }
      ],
      decisions: [
        { cond: "If the process will not die in D state", text: "It is waiting on I/O that has not returned, often a network mount or failing disk. Escalate to the storage or network team. Rebooting may hang as well, and may lose evidence." },
        { cond: "If kernel logs show the OOM killer", text: "The host ran out of memory. Report the process list and sizing to the service owner; restarting the application again will not change the sizing." },
        { cond: "If only the graphical session is frozen", text: "Switch to a text console and inspect from there. Restarting the display manager ends every session on that machine, so check who else is logged in." },
        { cond: "If the load is high with low CPU", text: "Look at disk and network I/O before blaming the application. Killing it will not fix a saturated device." }
      ],
      verify: [
        "The user can use the application again and their data is intact.",
        "Load, memory, and disk I/O are back within normal range for that host.",
        "Any monitoring alert raised by the incident has cleared."
      ],
      document: "Note the process, signal, timeline, and the evidence you collected before terminating it.",
      dist: "Commands and signals are the same across distributions. Unit names differ: the display manager may be gdm, lightdm, sddm, or another depending on the desktop and distribution."
    },
    {
      id: "access",
      full: "The user cannot sign in with a known password, their account is locked, or they need administrative rights for a task.",
      num: "04",
      title: "Password reset, account lockout, or a sudo request",
      symptom: "A known password is rejected, the account is locked, or the user wants admin rights.",
      triage: "Verify identity and approval. Establish whether the account is local or central.",
      causes: [
        "Forgotten or mistyped password, including keyboard layout and Caps Lock.",
        "Password expired, or the account requires a change at next login.",
        "Account locked by failed-attempt counting, or administratively locked.",
        "The account is centrally managed, so a local reset is ignored or overwritten.",
        "Authentication service unreachable: directory server, network, or time skew breaking Kerberos.",
        "For sudo: the user is not in the administrative group, or the request needs a specific sudoers rule."
      ],
      steps: [
        { tag: "Authorization", text: "Verify the requester's identity and that they are entitled to the account, using your organization's approved method. Record the approval reference before making any change." },
        { tag: "Scope", text: "Establish whether the account is local or central. If it comes from a directory service, the fix belongs in that system, not on this host.", cmd: "getent passwd <user>; getent group sudo wheel 2>/dev/null; grep '^passwd' /etc/nsswitch.conf" },
        { tag: "Diagnose", text: "Check the account's password status and ageing information. Status shows whether a usable password is set, locked, or absent.", cmd: "sudo passwd -S <user>; sudo chage -l <user>" },
        { tag: "Diagnose", text: "Check for failed-attempt lockout on systems using pam_faillock, and read the authentication log for the reason the login failed.", cmd: "sudo faillock --user <user> 2>/dev/null; sudo journalctl -u ssh -n 40 --no-pager" },
        { tag: "Decision", text: "Separate three cases: forgotten password (reset), lockout (unlock after verification), and a suspected compromise (security process, not a reset). Choose the action that matches, and involve the identity team if the account is centrally managed." },
        { tag: "Fix", text: "Set a temporary password for a local account and require a change at next login. Communicate the password out of band, never in the same channel as the request.", cmd: "sudo passwd <user> && sudo chage -d 0 <user>" },
        { tag: "Fix", text: "Clear a failed-attempt lockout after verification. This unlocks the account; it does not change the password.", cmd: "sudo faillock --user <user> --reset", note: "Debian-family and RHEL-family systems with libpam-modules both provide faillock. On older hosts the lock may be a ! or * in the password field, so check the actual status first." },
        { tag: "Fix", text: "For sudo, add the user to the administrative group on the specific host, with approval. Group membership applies to new sessions, not sessions already open.", cmd: "sudo usermod -aG sudo <user>", note: "RHEL family uses the wheel group: sudo usermod -aG wheel <user>. Append with -aG; omitting -a removes the user from other groups." },
        { tag: "Fix", text: "If a narrower grant is appropriate, write a drop-in sudoers file through visudo so the syntax is validated, then test the exact command the user needs. Never edit /etc/sudoers directly.", cmd: "sudo visudo -f /etc/sudoers.d/<user>-support" },
        { tag: "Verify", text: "Have the user sign in with the new credentials from a fresh session, and confirm the intended access works without granting more than intended.", cmd: "sudo -l -U <user>" },
        { tag: "Document", text: "Record who authorized the change, what was reset or granted, on which host, and when. Note any central system that also needed updating." }
      ],
      decisions: [
        { cond: "If the account comes from a directory service", text: "Reset it in that system or escalate to the identity team. A local passwd change will be ignored at best, and confusing at worst." },
        { cond: "If there are signs of compromise", text: "Stop. Follow the security incident process, preserve logs, and do not simply reset the password and close the ticket." },
        { cond: "If a reset appears not to work", text: "Check for cached credentials, an active session that was never ended, and reachability of the authentication service. Then check time sync, since Kerberos fails on clock skew." },
        { cond: "If sudo access is requested", text: "Grant the narrowest rule that completes the task, for the shortest reasonable period, with written approval. Locking a password does not revoke SSH keys, active sessions, or directory-based access; a full revocation is a separate, coordinated step." }
      ],
      verify: [
        "The user signs in successfully in a new session with the new credentials.",
        "sudo -l -U shows exactly the intended rights and nothing broader.",
        "Any old credentials or approved temporary grants are recorded for expiry."
      ],
      document: "Record the approval reference, the account, the host, the change made, and the expiry or follow-up for any temporary grant.",
      dist: "Local reset and group commands are the same across distributions; the administrative group is sudo on Debian/Ubuntu and wheel on the RHEL family. Lockout policy and log locations come from local PAM configuration, so read it."
    },
    {
      id: "network",
      full: "The interface shows as connected, but a share, an intranet site, or an internet service does not load. Sometimes one application fails while browsing works.",
      num: "05",
      title: "Network connected but internal or external resources are unavailable",
      symptom: "The link is up, but an internal or internet resource does not load.",
      triage: "Test by address first, then by name. That splits routing from DNS.",
      causes: [
        "Name resolution failing while routing works.",
        "No usable address, or an address from the wrong network, after DHCP failure.",
        "VPN not connected, or split tunneling not carrying the internal route.",
        "A captive portal intercepting traffic on guest or hotel networks.",
        "Proxy configuration required by policy, or a stale proxy setting in the environment.",
        "Firewall rule, security group, or upstream service outage.",
        "MTU or path issue on a tunnel, which breaks large responses but not small ones."
      ],
      steps: [
        { tag: "Scope", text: "Ask whether the failure affects one host or several, one site or all sites, and internal resources, external resources, or both. The pattern usually narrows the cause immediately." },
        { tag: "Diagnose", text: "Check link state, addresses, and the routing table. An address starting 169.254 means DHCP did not answer.", cmd: "ip -brief link; ip -brief address; ip route" },
        { tag: "Diagnose", text: "Test in layers: the loopback, the default gateway, then a public address. Treat ping as advisory, since many networks and hosts block ICMP; a timeout is not proof the target is down.", cmd: "ping -c 3 127.0.0.1; ping -c 3 $(ip route | awk '/default/ {print $3; exit}')" },
        { tag: "Diagnose", text: "Compare resolution with connectivity. Ask the system resolver the way applications do, then query the DNS server directly if a tool is available.", cmd: "getent hosts intranet.example.com; resolvectl query intranet.example.com 2>/dev/null" },
        { tag: "Diagnose", text: "Read the resolver and proxy configuration in effect, since a stub resolver or an inherited proxy variable explains many 'the internet is broken' tickets.", cmd: "cat /etc/resolv.conf; env | grep -i proxy" },
        { tag: "Decision", text: "If names fail and addresses work, it is DNS or the name mapping. If both fail, it is routing, firewall, or the service. If only one application fails, it is the application's own configuration or its port, not the host's network." },
        { tag: "Fix", text: "For a DHCP failure, renew the lease on the specific interface. On NetworkManager hosts, bring the connection down and up instead; on systemd-networkd hosts, restart systemd-networkd.", cmd: "sudo dhclient -v <interface>", note: "Prefer nmcli connection up <name> on NetworkManager hosts, or sudo systemctl restart systemd-networkd on hosts managed by systemd-networkd. Confirm which network manager is in use first." },
        { tag: "Diagnose", text: "For internal-only failures, check whether the VPN is up and whether the internal route exists. Ask the VPN owner for split-tunnel policy. Do not add routes on the user's machine to work around it.", cmd: "ip route get 10.0.0.10; ss -tnp | head" },
        { tag: "Verify", text: "Have the user open the actual resource they reported. A successful ping does not prove DNS, TLS, authentication, or the application work." },
        { tag: "Document", text: "Record what you tested and what you ruled out. That record saves the next technician from repeating the same four checks." }
      ],
      decisions: [
        { cond: "If names fail but IP addresses work", text: "Check the resolver configuration and test against the expected DNS server. If the server itself is wrong, escalate to the DNS or network owner with the query and response." },
        { cond: "If the interface has a 169.254 address", text: "DHCP did not answer. Confirm the port or VLAN first, then renew. Repeated failures point to switch, DHCP scope, or authorization." },
        { cond: "If internal resources fail on VPN", text: "Verify the tunnel and the routes it installs. Do not add permanent static routes on a user's laptop to work around a VPN policy." },
        { cond: "If everything works for you but not the user", text: "Compare profiles, proxy settings, and whether the user is on the same network. Test as that user before concluding the network is healthy." }
      ],
      verify: [
        "The user reaches the exact resource they reported, in their own session.",
        "Name resolution for that resource returns the expected address.",
        "Any temporary change made during diagnosis has been removed."
      ],
      document: "Note the layer that failed, the evidence, and any ticket raised with the network, DNS, or VPN owner.",
      dist: "ip, ss, and resolvectl come from iproute2 and systemd and are present on most current distributions; ifconfig, netstat, and dig may be absent or need separate packages. NetworkManager is common on desktops, systemd-networkd often on servers, and netplan configures the network on Ubuntu Server."
    },
    {
      id: "packages",
      full: "An install fails with a lock or couldn't-get-lock error, a repository cannot be reached, or dependencies conflict and the package manager refuses to continue.",
      num: "06",
      title: "Software installation, repository, or package-manager lock failure",
      symptom: "An install stops on a lock, an unreachable repository, or a dependency conflict.",
      triage: "Check for a running package process before touching any lock file.",
      causes: [
        "Another package process is active: an administrator, a configuration tool, or an unattended upgrade.",
        "A previous run crashed and left lock files with no owning process.",
        "Repository unreachable: network, proxy, mirror outage, or a wrong URL for the release.",
        "Signature verification failing because of a missing or rotated key, or a clock that is far off.",
        "Insufficient space on /, /var, or /boot for the download or the kernel update.",
        "Package conflict, a held package, or a repository from a different distribution version.",
        "On subscribed RHEL systems, the host is not attached to the expected repositories."
      ],
      steps: [
        { tag: "Scope", text: "Read the complete error and note which lock or repository it names. Capture the full output before retrying, because the first line often names the real problem." },
        { tag: "Diagnose", text: "Check whether a package process is actually running, and how long it has been running. A long unattended upgrade is not a stuck lock.", cmd: "ps -eo pid,etime,cmd | grep -E 'apt|dpkg|dnf|yum|rpm|unattended' | grep -v grep" },
        { tag: "Diagnose", text: "Check the scheduled update units on Debian-family hosts. On the RHEL family, check dnf-makecache.timer and any configured update timer instead.", cmd: "systemctl status apt-daily.service apt-daily-upgrade.service --no-pager" },
        { tag: "Diagnose", text: "Identify which process holds the lock, if any. If a real process owns it, wait or coordinate with whoever started it.", cmd: "sudo lsof /var/lib/dpkg/lock-frontend 2>/dev/null" },
        { tag: "Decision", text: "If a process is running: wait, or ask the person who started it to finish. If no process owns the lock and a previous run was interrupted: repair the package database state with the package manager, with approval. Do not delete lock files." },
        { tag: "Fix", text: "Only after confirming no package process is active: complete any interrupted configuration, then fix broken dependencies. This is a state change to the installed system, so take note of what it reports.", cmd: "sudo dpkg --configure -a && sudo apt-get -f install", note: "Debian-family. RHEL family has no separate configuration step; if a transaction was interrupted, re-run with sudo dnf check and read the output before any repair." },
        { tag: "Diagnose", text: "For repository errors, check name resolution and reachability of the repository URL, then read the configured sources. A wrong release codename fails immediately and obviously.", cmd: "grep -rhs '^[^#]' /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null | head", note: "RHEL family: dnf repolist -v, and subscription-manager status on subscribed hosts." },
        { tag: "Diagnose", text: "Check the clock before blaming keys. A large time difference breaks TLS and signature checks in ways that look like repository faults.", cmd: "timedatectl" },
        { tag: "Diagnose", text: "Confirm there is room for the download and the unpack. Kernel updates need space in /boot specifically.", cmd: "df -h / /var /boot" },
        { tag: "Verify", text: "Confirm the package is installed and the application starts. A zero exit code is not enough.", cmd: "dpkg -l <package> | tail -n 1; command -v <command>", note: "RHEL family: rpm -q <package>." },
        { tag: "Document", text: "Record the repository or lock involved, whether the cause was a running process, a network or key problem, or a conflict, and what changed on the host." }
      ],
      decisions: [
        { cond: "If a genuine package process is running", text: "Wait for it or reschedule with its owner. Interrupting a package transaction can leave the database in an inconsistent state that is worse than the delay." },
        { cond: "If no process owns the lock", text: "The previous run was interrupted. Repair through the package manager and read its output. Removing lock files lets two transactions collide." },
        { cond: "If a repository is unreachable but the network is fine", text: "Proxy, firewall, or mirror outage. Escalate to the repository owner with the URL and the error. Adding third-party mirrors is not a fix." },
        { cond: "If dependencies conflict", text: "Do not force with --force-yes or --nodeps on a production host. Capture the full solver output and escalate; the conflict usually means mixed repositories." }
      ],
      verify: [
        "The package reports as installed, and the command or service it provides works.",
        "The package manager now runs without lock or repository errors.",
        "No additional packages were removed as a side effect; check the transaction summary."
      ],
      document: "Note the exact package and repository, the output, the cause, and any approval reference for the repair.",
      dist: "Debian/Ubuntu: apt, dpkg, /var/lib/dpkg/lock-frontend, apt-daily units. RHEL family: dnf (yum is a compatibility command), rpm, subscription-manager, /var/cache/dnf. Immutable-image distributions use different tooling entirely, so check the distribution before running anything here."
    },
    {
      id: "backup",
      full: "A backup did not complete, a migrated profile is missing files or has wrong ownership, or a drive reports warnings, read errors, or has gone read-only.",
      num: "07",
      title: "Data backup, profile migration, or a suspected failing drive",
      symptom: "A backup failed, a migrated profile lost files, or a drive reports errors.",
      triage: "On a suspect drive, stop writes, collect logs, and escalate.",
      causes: [
        "Backup target full, unreachable, or credentials expired.",
        "Source files locked or changing during the copy, so some files were skipped.",
        "Ownership and permissions lost because the destination filesystem cannot store them.",
        "Different user IDs on the destination host after a migration.",
        "Failing sectors, a loose cable or port, or a power event leaving a filesystem unclean.",
        "Filesystem remounted read-only after I/O errors, which protects data but looks like a permissions fault.",
        "Encrypted home directory not unlocked for the session doing the copy."
      ],
      steps: [
        { tag: "Scope", text: "Establish what data is involved, where the backup or migration runs, whether the source is still in use, and what the user needs first. Agree the priority order of files before copying anything." },
        { tag: "Diagnose", text: "For a suspected drive, read the kernel log for I/O and hardware errors before doing anything else. This is read-only and preserves the evidence.", cmd: "sudo dmesg -T | tail -n 60" },
        { tag: "Diagnose", text: "Check SMART health if smartmontools is installed. Reads are safe; do not start self-tests or repairs on a device in production without approval.", cmd: "sudo smartctl -H /dev/<device>", note: "smartmontools is not installed by default everywhere. If it is absent, rely on kernel logs and escalate; installing packages during an incident adds risk." },
        { tag: "Diagnose", text: "Check whether the filesystem is mounted read-only after errors. That is usually the kernel protecting data, not a permissions problem.", cmd: "findmnt -T /path -o TARGET,SOURCE,FSTYPE,OPTIONS" },
        { tag: "Decision", text: "If the device is failing, stop using it and follow your data-handling and hardware process: escalate to storage, minimize writes, and copy only the most important data first. Do not present dd as a recovery method; it copies errors, can take hours, and may worsen a failing drive. ddrescue and professional recovery are specialist calls for the storage team." },
        { tag: "Fix", text: "Copy data to known-good media with a dry run first, then the real run. The trailing slash on the source means 'contents of', which is a common cause of deeply nested duplicate directories.", cmd: "rsync -a --info=progress2 --dry-run /source/ /dest/" },
        { tag: "Fix", text: "When restoring to a host where user IDs match, preserve ownership, permissions, ACLs, and extended attributes. Where they do not, decide the ownership mapping first and apply it to the specific paths.", cmd: "sudo rsync -aHAX /backup/profile/ /home/<user>/", note: "Requires elevated privileges to preserve ownership. Skip -A and -X if the destination filesystem does not support them." },
        { tag: "Fix", text: "For a profile migration, exclude caches and trash, and leave the destination's existing session files alone until you know they are stale.", cmd: "rsync -a --exclude='.cache/' --exclude='.local/share/Trash/' /home/<user>/ /mnt/newhome/<user>/" },
        { tag: "Verify", text: "Compare file counts and sizes, then open a few of the user's most important files as the user. A backup is not verified until someone has read from it." },
        { tag: "Document", text: "Record the device serial or target path, the errors seen, what was copied where, and the storage or incident ticket reference." }
      ],
      decisions: [
        { cond: "If SMART or kernel logs show failing hardware", text: "Stop writes, preserve evidence, notify the owner, and escalate to the storage team. Do not run fsck, mkfs, or full-device copies on a failing disk as a first response." },
        { cond: "If the backup failed on capacity", text: "This is not yet a data loss event. Fix target capacity or retention, then re-run and check the job's exit code." },
        { cond: "If the migration produced wrong ownership", text: "Map the old and new IDs explicitly and apply that mapping to named paths. A recursive ownership change over an entire home can hand one user's files to another." },
        { cond: "If files are missing after the copy", text: "Check the job log for skipped files, exclusions, permission errors, and files that changed during the transfer. Re-run those paths only." }
      ],
      verify: [
        "The user opens representative files from the restored or migrated location.",
        "The backup job reports success and its log shows the expected file count.",
        "Any failing device is documented and out of service, or handed to storage with evidence."
      ],
      document: "Note the source, destination, method, what was excluded, and the verification the user performed.",
      dist: "rsync is packaged as rsync everywhere but is not always preinstalled. smartmontools needs a separate install. Default filesystems differ, so check the destination with findmnt before assuming ACL or xattr support."
    },
    {
      id: "cron",
      full: "A scheduled script, report, or backup produced no output at the expected time, or ran with results that suggest it used the wrong environment.",
      num: "08",
      title: "Scheduled cron job or backup did not run",
      symptom: "A cron job or backup produced nothing at the scheduled time.",
      triage: "Confirm whose crontab you read, then whether the job ran at all.",
      causes: [
        "The job is in a different user's crontab, often root's rather than the application user's.",
        "The cron service is stopped, masked, or not enabled at boot.",
        "The schedule fields do not mean what the requester expected, or the host timezone differs from the requester's.",
        "The script relies on PATH, environment variables, or a working directory that cron does not provide.",
        "A literal % in the command was not escaped, which cron treats as a newline.",
        "Missing execute bit, wrong interpreter, or file permissions that the job's user lacks.",
        "Output was never redirected, so a failure left no record anywhere.",
        "The job moved to a systemd timer, or the host was off at the scheduled time and the job is not persistent."
      ],
      steps: [
        { tag: "Scope", text: "Establish the job name, the intended user, the host, and the expected run time. Then read that user's crontab explicitly, since your own crontab is a different file.", cmd: "sudo crontab -l -u <user>" },
        { tag: "Diagnose", text: "Confirm cron is running and enabled. The service name differs between distributions.", cmd: "systemctl status cron --no-pager", note: "RHEL family: systemctl status crond. If the unit is missing, check whether scheduling moved to systemd timers." },
        { tag: "Diagnose", text: "Look for a record that the job ran. Log locations depend on the host's logging configuration, and a job that ran may still leave no trace if logs are shipped elsewhere.", cmd: "sudo journalctl -u cron --since '24 hours ago' --no-pager | tail -n 40" },
        { tag: "Diagnose", text: "Check for a competing systemd timer, and whether the schedule was migrated.", cmd: "systemctl list-timers --all --no-pager | head -n 20" },
        { tag: "Diagnose", text: "Reproduce the job as the job's user in a minimal environment. This exposes PATH and variable assumptions that disappear in an interactive shell.", cmd: "sudo -u <user> env -i /bin/sh -c '/path/to/script.sh'" },
        { tag: "Decision", text: "If the job never ran: the schedule, service, timezone, or user is wrong. If it ran and failed: the environment, paths, or permissions are wrong. Fix the cause; a retry or a second schedule hides it." },
        { tag: "Fix", text: "Make every path absolute inside the script and set any needed variables at the top of the crontab. Add a test entry with a near-term schedule, watch it fire, then remove it.", cmd: "0 2 * * * /usr/local/bin/nightly-backup.sh >> /var/log/nightly-backup.log 2>&1" },
        { tag: "Diagnose", text: "Check the schedule fields against the actual clock and timezone, and escape any percent sign in a command or it will be read as a newline.", cmd: "timedatectl; date" },
        { tag: "Verify", text: "Wait for the next scheduled run, or trigger the same command in the same environment, then confirm the artefact exists with a current timestamp and a zero exit status." },
        { tag: "Document", text: "Record the crontab line, the user, the timezone, what was wrong, and the evidence from the successful run." }
      ],
      decisions: [
        { cond: "If there is no log line at all", text: "The job never started. Work through service state, schedule, timezone, and which crontab was edited. Add output redirection so the next attempt leaves evidence." },
        { cond: "If the job ran but did nothing useful", text: "Environment and paths. Run it with env -i as the job's user, fix the script, and keep the redirection in place." },
        { cond: "If a systemd timer has replaced cron", text: "Check both, then remove the stale duplicate so there are not two schedules with different behaviour." },
        { cond: "If the host was asleep or off", text: "Cron does not catch up on missed runs by default. If the job must recover, use a timer with Persistent=true or the anacron approach, with the owner's agreement." }
      ],
      verify: [
        "A test run at a known time produced the expected output file with a current timestamp.",
        "The job's log records the run, and the exit status is zero.",
        "Any temporary test schedule has been removed."
      ],
      document: "Note the crontab line, the user, the corrected cause, and the timestamp of the verified run.",
      dist: "Debian/Ubuntu: service cron, logs often in /var/log/syslog, faillock and unattended-upgrades units present. RHEL family: service crond, logs often in /var/log/cron or /var/log/messages. Both may ship logs off-host, so check the logging configuration."
    },
    {
      id: "incident",
      full: "A host rebooted without a change record, a service went down, or someone has asked what happened on a machine at a given time.",
      num: "09",
      title: "Unexpected reboot, service outage, or a security-log investigation",
      symptom: "A host rebooted with no change record, a service dropped, or someone asks what happened when.",
      triage: "Build the timeline before changing anything. Preserve evidence if this may be a security event.",
      causes: [
        "Kernel panic, hardware fault, power event, or thermal shutdown.",
        "Memory exhaustion leading the kernel to kill processes, followed by a service restart or a reboot.",
        "Planned maintenance, patch run, or a reboot by another administrator.",
        "Service crash, failed dependency, expired certificate, or configuration change.",
        "Storage or network dependency becoming unavailable.",
        "For a security question: unauthorized access, exposed credentials or keys, or vulnerability exploitation. Legitimate administrative activity is also a possibility and must not be ruled out."
      ],
      steps: [
        { tag: "Scope", text: "Confirm the host, the time window, and the business impact. Ask whether there is a change record or maintenance window that covers the event." },
        { tag: "Diagnose", text: "Establish the boot history and the previous boot's log boundary. Read the end of the previous boot first; the last lines before a crash are usually the most informative.", cmd: "last reboot | head -n 5; journalctl --list-boots --no-pager | tail -n 5" },
        { tag: "Diagnose", text: "Read the tail of the previous boot for kernel-level causes: panic, out-of-memory, machine check, thermal, or storage errors.", cmd: "sudo journalctl -k -b -1 -n 200 --no-pager | grep -i -E 'panic|oom|mce|thermal|I/O error|watchdog'" },
        { tag: "Diagnose", text: "For a service outage without a reboot, read the unit's own record and the list of failed units. Fix the dependency, not the symptom.", cmd: "systemctl --failed --no-pager; systemctl status <service> --no-pager -l; sudo journalctl -u <service> --since '2 hours ago' --no-pager" },
        { tag: "Decision", text: "If the evidence points to hardware, power, or thermal, escalate to facilities or hardware with the log extract. If it points to a service or dependency, hand it to the service owner. If authentication or access evidence looks wrong, invoke the security incident process now." },
        { tag: "Security", text: "On a possible security event, preserve evidence before touching anything: copy the relevant logs elsewhere, record hashes, and note who accessed them. Do not edit, truncate, or delete logs, and do not reboot a suspect host without direction from the incident lead.", cmd: "sudo sha256sum /var/log/auth.log | tee /root/incident-<ticket>-auth.sha256", note: "The file name differs by distribution: /var/log/auth.log on Debian/Ubuntu with rsyslog, /var/log/secure on the RHEL family. If logs go only to the journal, export them with journalctl instead." },
        { tag: "Security", text: "Review authentication records for the window in question: successful and failed logins, session starts, and privilege escalation. Read them as questions, not conclusions.", cmd: "sudo journalctl _COMM=sshd --since '24 hours ago' --no-pager | tail -n 100" },
        { tag: "Security", text: "Check who is or was logged in, and whether any unexpected network connections exist. Absence of an anomaly in these views is not proof the host is clean.", cmd: "who; last -n 20; ss -tnp | head -n 20" },
        { tag: "Verify", text: "Confirm the service is healthy and monitoring has cleared, or for a security event, hand verification and closure to the incident lead with the evidence package intact." },
        { tag: "Document", text: "Write a timestamped timeline with the source of each entry, what you preserved and where, and who has access to it. Logging is configured per host: not every command or sudo invocation is recorded, so a gap in the logs is not proof that nothing happened." }
      ],
      decisions: [
        { cond: "If the previous boot ends in a panic or hardware error", text: "Treat it as a hardware or kernel fault. Capture the extract, escalate, and avoid repeated reboots that overwrite the evidence." },
        { cond: "If a service failed without a reboot", text: "Read the unit log and resolve the dependency, certificate, or configuration cause. Restart is a temporary measure and should be recorded as such." },
        { cond: "If authentication logs show unexpected success or privilege escalation", text: "Escalate immediately under the incident process. Do not reset passwords or remove accounts before the incident lead decides, since that destroys evidence." },
        { cond: "If the activity turns out to be authorized", text: "Say so with evidence: change record, ticket, and operator. Do not imply misconduct from an unexplained entry." }
      ],
      verify: [
        "The service is running with the expected configuration and monitoring has cleared.",
        "The cause is recorded against a ticket, or an incident is open with an owner.",
        "Preserved evidence is stored where policy requires, with recorded hashes and access."
      ],
      document: "Note the timeline, sources, evidence location and hashes, who was involved, and the incident or change reference.",
      dist: "Debian/Ubuntu: /var/log/auth.log with rsyslog, /var/log/syslog. RHEL family: /var/log/secure, /var/log/messages; auditd may hold additional records if it is installed and configured. journalctl works on both when the journal is present."
    }
  ];

  /* ---------------- ticket rendering ---------------- */

  var gridEl = document.getElementById("ticket-grid");
  var dialog = document.getElementById("ticket-sheet");
  var sheetNum = document.getElementById("sheet-num");
  var sheetTitle = document.getElementById("sheet-title");
  var sheetBody = document.getElementById("sheet-body");
  var closeBtn = document.getElementById("sheet-close");
  var storageNote = document.getElementById("storage-status");

  var STORE_KEY = "tuxdesk.progress.v1";
  var storageOk = (function () {
    try {
      var probe = "__tuxdesk_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  })();

  if (!storageOk) storageNote.hidden = false;

  var progress = loadProgress();
  var lastTrigger = null;

  function loadProgress() {
    if (!storageOk) return {};
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      var clean = {};
      Object.keys(parsed).forEach(function (key) {
        if (Array.isArray(parsed[key])) {
          clean[key] = parsed[key].filter(function (n) { return typeof n === "number"; });
        }
      });
      return clean;
    } catch (err) {
      return {};
    }
  }

  function saveProgress() {
    if (!storageOk) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(progress));
    } catch (err) {
      storageOk = false;
      storageNote.hidden = false;
    }
  }

  function ticked(ticket) {
    return Array.isArray(progress[ticket.id]) ? progress[ticket.id] : [];
  }

  function setTicked(ticket, indices) {
    progress[ticket.id] = indices;
    saveProgress();
  }

  function progressBar(ticket, counter, fill, trackClass) {
    var done = ticked(ticket).length;
    var total = ticket.steps.length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    if (counter) counter.textContent = done + " of " + total + " steps done";
    if (fill) fill.style.width = pct + "%";
    if (counter && counter.parentNode) {
      counter.parentNode.setAttribute("data-complete", done === total && total > 0 ? "true" : "false");
    }
    return pct;
  }

  function updateCardProgress(ticket, card) {
    var count = card.querySelector(".progress-count");
    var fill = card.querySelector(".progress-fill");
    var wrap = card.querySelector(".progress-mini");
    var done = ticked(ticket).length;
    var total = ticket.steps.length;
    count.textContent = done + "/" + total + " steps";
    fill.style.width = (total ? Math.round((done / total) * 100) : 0) + "%";
    wrap.setAttribute("data-complete", done === total && total > 0 ? "true" : "false");
    var openBtn = card.querySelector(".open-ticket");
    openBtn.setAttribute("aria-label", "Open checklist for ticket " + ticket.num + ": " + ticket.title + ". " + done + " of " + total + " steps complete.");
  }

  TICKETS.forEach(function (ticket) {
    var card = el("article", { class: "ticket card" });
    card.appendChild(el("div", { class: "card-top" }, [
      el("span", { class: "card-num", text: ticket.num }),
      el("span", { class: "card-tag", text: "Tier 1\u20132" })
    ]));
    card.appendChild(el("h3", { text: ticket.title }));
    card.appendChild(el("p", { class: "ticket-symptom card-body", text: ticket.symptom }));

    var triage = el("p", { class: "card-note" }, [
      el("strong", { text: "Triage: " }),
      document.createTextNode(ticket.triage)
    ]);
    card.appendChild(triage);

    var mini = el("div", { class: "progress-mini" }, [
      el("span", { class: "progress-track", "aria-hidden": "true" }, el("span", { class: "progress-fill" })),
      el("span", { class: "progress-count progress-label", text: "0/" + ticket.steps.length + " steps" })
    ]);
    mini.setAttribute("data-complete", "false");

    var openBtn = el("button", { type: "button", class: "btn open-ticket" }, [
      document.createTextNode("Open checklist"),
      el("span", { class: "arrow", "aria-hidden": "true", text: "\u2192" })
    ]);
    openBtn.addEventListener("click", function () {
      lastTrigger = openBtn;
      openTicket(ticket, card);
    });

    card.appendChild(el("div", { class: "card-foot" }, [mini, openBtn]));
    gridEl.appendChild(card);
    ticket._card = card;
    ticket._search = (ticket.num + " " + ticket.title + " " + ticket.symptom + " " + ticket.triage + " " + ticket.causes.join(" ")).toLowerCase();
    updateCardProgress(ticket, card);
  });

  /* ---------------- ticket filter ---------------- */

  var ticketSearch = document.getElementById("ticket-search");
  var ticketStatus = document.getElementById("ticket-status");
  var ticketEmpty = document.getElementById("ticket-empty");
  var ticketClear = document.getElementById("ticket-clear");

  function filterTickets() {
    var query = ticketSearch.value.trim().toLowerCase();
    var shown = 0;
    TICKETS.forEach(function (ticket) {
      var match = !query || ticket._search.indexOf(query) !== -1;
      ticket._card.hidden = !match;
      if (match) shown += 1;
    });
    ticketEmpty.hidden = shown !== 0;
    ticketStatus.textContent = query
      ? shown + " of " + TICKETS.length + " tickets match."
      : TICKETS.length + " tickets shown";
  }

  ticketSearch.addEventListener("input", filterTickets);
  ticketSearch.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && ticketSearch.value) {
      event.preventDefault();
      ticketSearch.value = "";
      filterTickets();
    }
  });
  ticketClear.addEventListener("click", function () {
    ticketSearch.value = "";
    filterTickets();
    ticketSearch.focus();
  });
  filterTickets();

  function openTicket(ticket, card) {
    sheetNum.textContent = "Ticket " + ticket.num + " · " + ticket.steps.length + " checklist steps";
    sheetTitle.textContent = ticket.title;
    sheetBody.textContent = "";

    var controls = el("div", { class: "sheet-controls" });
    var counter = el("span", { class: "progress-label", text: "" });
    var progWrap = el("div", { class: "sheet-progress" }, [
      el("span", { class: "progress-track", "aria-hidden": "true" }, el("span", { class: "progress-fill" })),
      counter
    ]);
    progWrap.setAttribute("data-complete", "false");
    var fillEl = progWrap.querySelector(".progress-fill");

    var resetBtn = el("button", { type: "button", class: "btn btn-quiet", text: "Reset this checklist" });
    controls.appendChild(progWrap);
    controls.appendChild(resetBtn);
    sheetBody.appendChild(controls);

    var symptom = el("section", { class: "sheet-section" }, [
      el("h3", { text: "Reported symptom" }),
      el("p", { class: "sheet-lede", text: ticket.full || ticket.symptom })
    ]);
    sheetBody.appendChild(symptom);

    var causes = el("section", { class: "sheet-section" }, [
      el("h3", { text: "Possible causes" }),
      el("p", { text: "These are candidates to rule out, not a diagnosis. Confirm each one before acting." })
    ]);
    var causeList = el("ul", { class: "cause-list" });
    ticket.causes.forEach(function (cause) { causeList.appendChild(el("li", { text: cause })); });
    causes.appendChild(causeList);
    sheetBody.appendChild(causes);

    var stepsSection = el("section", { class: "sheet-section" }, [
      el("h3", { text: "Checklist" }),
      el("p", { text: "Work in order. The first items establish scope and authorization; do not skip to a fix." })
    ]);
    var list = el("ul", { class: "steps" });
    var inputs = [];

    ticket.steps.forEach(function (step, i) {
      var id = "step-" + ticket.id + "-" + i;
      var box = el("input", { type: "checkbox", id: id });
      box.checked = ticked(ticket).indexOf(i) !== -1;
      var label = el("label", { class: "step-check", for: id }, [
        box,
        el("span", { class: "step-label" }, [
          el("span", { class: "step-tag", text: step.tag }),
          document.createTextNode(step.text)
        ])
      ]);
      var li = el("li", { class: "step" }, label);
      if (step.cmd) li.appendChild(cmdBlock(step.cmd, step.note));
      list.appendChild(li);
      inputs.push(box);

      box.addEventListener("change", function () {
        var current = ticked(ticket).slice();
        var at = current.indexOf(i);
        if (box.checked && at === -1) current.push(i);
        if (!box.checked && at !== -1) current.splice(at, 1);
        setTicked(ticket, current);
        progressBar(ticket, counter, fillEl);
        updateCardProgress(ticket, card);
      });
    });

    stepsSection.appendChild(list);
    sheetBody.appendChild(stepsSection);

    var decSection = el("section", { class: "sheet-section" }, [
      el("h3", { text: "Decision points" })
    ]);
    ticket.decisions.forEach(function (decision) {
      decSection.appendChild(el("div", { class: "decision" }, [
        el("span", { class: "cond", text: decision.cond }),
        el("p", { text: decision.text })
      ]));
    });
    sheetBody.appendChild(decSection);

    var verify = el("section", { class: "sheet-section" }, [
      el("h3", { text: "Verify with the user" })
    ]);
    var vList = el("ul", { class: "verify-list" });
    ticket.verify.forEach(function (item) { vList.appendChild(el("li", { text: item })); });
    verify.appendChild(vList);
    verify.appendChild(el("p", { class: "small", text: ticket.document }));
    sheetBody.appendChild(verify);

    var dist = el("section", { class: "sheet-section" }, [
      el("h3", { text: "Distribution notes" }),
      el("p", { class: "dist-note", text: ticket.dist })
    ]);
    sheetBody.appendChild(dist);

    resetBtn.addEventListener("click", function () {
      setTicked(ticket, []);
      inputs.forEach(function (box) { box.checked = false; });
      progressBar(ticket, counter, fillEl);
      updateCardProgress(ticket, card);
      copyAnnounce.textContent = "Checklist reset for ticket " + ticket.num + ".";
      inputs[0].focus();
    });

    progressBar(ticket, counter, fillEl);
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    var firstBox = inputs[0];
    if (firstBox) firstBox.focus();
    else closeBtn.focus();
  }

  function closeDialog() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  closeBtn.addEventListener("click", closeDialog);

  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeDialog();
  });

  /* explicit trap: native modal dialogs let Tab escape in some browsers */
  dialog.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") return;
    var focusable = dialog.querySelectorAll('button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])');
    var list = Array.prototype.filter.call(focusable, function (node) {
      return !node.disabled && node.offsetParent !== null;
    });
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  dialog.addEventListener("cancel", function (event) {
    event.preventDefault();
    closeDialog();
  });

  dialog.addEventListener("close", function () {
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  });

  /* ---------------- technician basics ---------------- */

  var CMD_GROUPS = [
    {
      title: "Navigation and file inspection",
      tag: "Files & paths",
      blurb: "Finding out what exists, where you are, and what a file contains.",
      commands: [
        { name: "pwd", what: "Prints the working directory. Use it before any destructive command, or when a user says “I’m in the folder”.", cmd: "pwd" },
        { name: "cd", what: "Changes directory. With no argument it returns to your home directory; use cd - to go back to the previous one.", cmd: "cd /var/log && pwd" },
        { name: "ls", what: "Lists directory contents. -l for long format, -a to include hidden files, -h for readable sizes, -t to sort by modification time.", cmd: "ls -lah /etc | head -n 20" },
        { name: "cat", what: "Prints a whole file. Good for short configuration files; use less or tail for logs.", cmd: "cat /etc/os-release" },
        { name: "grep", what: "Searches text. -i ignores case, -r recurses, -n shows line numbers, -v inverts the match.", cmd: "grep -n 'PermitRootLogin' /etc/ssh/sshd_config" },
        { name: "cp", what: "Copies files. -a preserves permissions, ownership, and timestamps where permitted; -i asks before overwriting.", cmd: "sudo cp -a /etc/ssh/sshd_config /etc/ssh/sshd_config.bak" },
        { name: "mv", what: "Moves or renames. Across filesystems this is a copy followed by a delete, so it needs space at the destination.", cmd: "mv report.txt archive/report-2026-11.txt" }
      ]
    },
    {
      title: "Identity and privileges",
      tag: "Identity",
      blurb: "Knowing who you are and under what rights a command will run.",
      commands: [
        { name: "whoami", what: "Prints the effective user name. Under sudo it prints root, which is the usual reason a command behaves differently than expected.", cmd: "whoami; sudo whoami" },
        { name: "id", what: "Shows user ID, group ID, and supplementary groups. The quick answer to “is this user in the sudo group?”", cmd: "id <user>" },
        { name: "sudo", what: "Runs one command with elevated privileges, logging the invocation subject to local configuration. -u runs as another user; -l lists permitted commands.", cmd: "sudo -l -U <user>" },
        { name: "su", what: "Starts a shell as another user. su - gives a full login environment; without the dash you inherit the current environment, which confuses PATH-dependent tests.", cmd: "sudo su - <user> -c 'id'" }
      ]
    },
    {
      title: "Permissions and ownership",
      tag: "Permissions",
      blurb: "Reading and correcting who may do what, on the smallest path possible.",
      commands: [
        { name: "ls -l", what: "Shows the mode, link count, owner, group, size, and time. The first character tells you if it is a directory, symlink, or device.", cmd: "ls -l /path/to/file; ls -ld /path/to/directory" },
        { name: "chmod", what: "Changes mode bits. Use symbolic form (u+x, g-w) for a single path; avoid numeric 777 anywhere.", cmd: "chmod u+x ./script.sh" },
        { name: "chown", what: "Changes owner and group. Requires elevation. Keep it to named paths; a recursive change over a home directory can give files to the wrong account.", cmd: "sudo chown <user>:<group> /path/to/file" }
      ]
    },
    {
      title: "Processes and resources",
      tag: "Processes",
      blurb: "Identifying what is consuming the host before terminating anything.",
      commands: [
        { name: "top", what: "Live process and load view. Press M to sort by memory, P by CPU, and 1 to show per-core load. Use top -bn1 for one snapshot in a script.", cmd: "top -bn1 | head -n 12" },
        { name: "ps", what: "Lists processes. -e for all, -o to choose columns, --sort to order. The STAT column shows state; D means uninterruptible sleep, often I/O.", cmd: "ps -eo pid,user,stat,%cpu,%mem,cmd --sort=-%mem | head" },
        { name: "kill", what: "Sends a signal to a PID. -TERM asks the process to exit; -KILL forces it and loses unsaved work. Check the PID with ps first.", cmd: "kill -TERM <pid>" }
      ]
    },
    {
      title: "Packages",
      tag: "Packages",
      blurb: "Debian-family and RHEL-family tooling. Read the error before choosing a repair.",
      commands: [
        { name: "apt", what: "Debian-family package manager. update refreshes the metadata, install/remove change packages, and clean removes cached downloads only.", cmd: "sudo apt-get update && sudo apt-get install <package>", note: "apt on the command line, apt-get in scripts. Neither tool is present on RHEL-family hosts." },
        { name: "dnf / yum", what: "RHEL-family package manager. dnf is current; yum remains a compatibility command. repolist shows configured repositories.", cmd: "sudo dnf install <package>", note: "On older RHEL-family systems only yum is present, and some subcommands differ. Not available on Debian-family hosts." }
      ]
    },
    {
      title: "Storage and backup",
      tag: "Storage",
      blurb: "Measuring capacity and copying data without surprising side effects.",
      commands: [
        { name: "df", what: "Shows space per filesystem; -h for human units, -i for inode use, -T to include the filesystem type. Always check -i on a “disk full” ticket.", cmd: "df -hT; df -i" },
        { name: "du", what: "Shows space used per directory. -x stays on one filesystem, --max-depth limits depth, -s gives a single total. Needs read access to what it measures.", cmd: "sudo du -xh --max-depth=1 /var | sort -h | tail" },
        { name: "rsync", what: "Copies files efficiently, locally or over SSH. -a archives, -n dry-runs, --info=progress2 shows progress. A trailing slash on the source means “contents of”.", cmd: "rsync -a --info=progress2 --dry-run /source/ /dest/" }
      ]
    },
    {
      title: "Network checks",
      tag: "Network",
      blurb: "Layer-by-layer checks. Treat a missing reply as inconclusive, not as proof.",
      commands: [
        { name: "ip", what: "Addresses, links, and routes. -brief gives compact output; route get shows which path a destination would take.", cmd: "ip -brief address; ip route get 1.1.1.1" },
        { name: "ping", what: "Tests reachability with ICMP. Many hosts and networks block it, so no reply does not prove the target is down.", cmd: "ping -c 3 <host>" },
        { name: "getent hosts / dig", what: "Resolves names. getent uses the same resolver path as applications; dig queries a DNS server directly and may need a separate package.", cmd: "getent hosts intranet.example.com; dig +short intranet.example.com" },
        { name: "ssh", what: "Remote shell over SSH. -v raises verbosity for connection problems; check the client configuration and keys before blaming the network.", cmd: "ssh -v <user>@<host>" }
      ]
    },
    {
      title: "Scheduling and logs",
      tag: "Logs",
      blurb: "Cron and the journal, plus where distribution-specific logs live.",
      commands: [
        { name: "crontab", what: "Edits or lists a user's cron table. -l lists, -e edits, -r removes the whole table without confirmation. Editing another user's table needs elevation.", cmd: "sudo crontab -l -u <user>", note: "crontab -r deletes the entire table. Take a copy before editing anything on a production host." },
        { name: "journalctl", what: "Reads the systemd journal. -b selects a boot, -u a unit, --since a window, -f follows live output, -k shows kernel messages.", cmd: "journalctl -u <service> --since '1 hour ago' --no-pager" },
        { name: "Log files", what: "Traditional text logs vary by distribution and by whether syslog is installed: /var/log/auth.log or /var/log/secure for authentication, /var/log/syslog or /var/log/messages for general system messages.", cmd: "sudo ls -lh /var/log | head -n 20" }
      ]
    }
  ];

  var groupsEl = document.getElementById("cmd-groups");
  var cmdSearch = document.getElementById("cmd-search");
  var cmdStatus = document.getElementById("cmd-status");
  var cmdEmpty = document.getElementById("cmd-empty");
  var cmdClear = document.getElementById("cmd-clear");
  var rowIndex = [];
  var cardEntries = [];

  CMD_GROUPS.forEach(function (group, groupIndex) {
    var num = String(groupIndex + 1).padStart(2, "0");
    var panelId = "cmd-panel-" + groupIndex;
    var titleId = "cmd-title-" + groupIndex;

    var names = [];
    group.commands.forEach(function (command) {
      names.push(el("code", { class: "cmd-chip", text: command.name }));
    });

    var toggle = el("button", {
      type: "button",
      class: "cmd-card-toggle",
      "aria-expanded": "false"
    }, [
      el("span", { class: "card-top" }, [
        el("span", { class: "card-num", text: num }),
        el("span", { class: "card-tag", text: group.tag })
      ]),
      el("h3", { id: titleId, text: group.title }),
      el("span", { class: "card-body", text: group.blurb }),
      el("span", { class: "cmd-chips" }, names),
      el("span", { class: "cmd-meta" }, [
        el("span", { class: "progress-mini", "data-complete": "false" }, [
          el("span", { class: "progress-track", "aria-hidden": "true" }, el("span", { class: "progress-fill" })),
          el("span", { class: "progress-label cmd-count", text: "" })
        ]),
        el("span", { class: "cmd-toggle-text", text: "Open box" }),
        chevron()
      ])
    ]);
    toggle.setAttribute("aria-controls", panelId);

    var items = el("dl", { class: "cmd-items" });
    group.commands.forEach(function (command) {
      var entry = el("div", { class: "cmd-item" }, [
        el("dt", { class: "cmd-name", text: command.name }),
        el("dd", { class: "cmd-what", text: command.what })
      ]);
      if (command.cmd) entry.appendChild(el("dd", { class: "cmd-line" }, [cmdBlock(command.cmd, command.note)]));
      items.appendChild(entry);
      rowIndex.push({
        node: entry,
        section: toggle,
        text: (command.name + " " + command.what + " " + command.cmd + " " + group.title).toLowerCase()
      });
    });

    var empty = el("p", { class: "cmd-panel-empty", hidden: true }, [
      document.createTextNode("No command in this box matches the filter. "),
      el("button", { type: "button", class: "btn btn-quiet cmd-panel-clear", text: "Clear filter" })
    ]);

    var panel = el("div", { class: "cmd-panel", id: panelId, role: "region", "aria-labelledby": titleId, hidden: true }, [
      items, empty
    ]);

    var card = el("section", { class: "cmd-card card cmd-collapsible" }, [toggle, panel]);
    groupsEl.appendChild(card);

    var record = {
      card: card,
      toggle: toggle,
      panel: panel,
      items: items,
      empty: empty,
      count: toggle.querySelector(".cmd-count"),
      total: group.commands.length
    };
    cardEntries.push(record);
    toggle._record = record;

    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      record.userOpen = open;
      setOpen(record, open, open);
    });

    empty.querySelector("button").addEventListener("click", function () {
      cmdSearch.value = "";
      filterCommands();
      cmdSearch.focus();
    });

    applyCardFilter(record);
  });

  function chevron() {
    var template = document.createElement("template");
    template.innerHTML = '<svg class="chevron" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return template.content.firstElementChild;
  }

  function setOpen(record, open, moveFocus) {
    record.card.classList.toggle("is-open", open);
    record.toggle.setAttribute("aria-expanded", open ? "true" : "false");
    record.panel.hidden = !open;
    record.toggle.querySelector(".cmd-toggle-text").textContent = open ? "Close box" : "Open box";
    if (open && moveFocus) {
      record.panel.setAttribute("tabindex", "-1");
      var smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      record.card.scrollIntoView({ behavior: smooth, block: "start" });
      var firstCmd = record.panel.querySelector(".copy-btn");
      (firstCmd || record.panel).focus({ preventScroll: true });
    }
  }

  function applyCardFilter(record) {
    var query = cmdSearch.value.trim().toLowerCase();
    var shown = 0;
    rowIndex.forEach(function (entry) {
      if (entry.section !== record.toggle) return;
      var match = !query || entry.text.indexOf(query) !== -1;
      entry.node.hidden = !match;
      if (match) shown += 1;
    });
    record.card.hidden = shown === 0;
    record.empty.hidden = shown !== 0;
    record.count.textContent = shown + " of " + record.total + " commands";
    var complete = shown === record.total && record.total > 0;
    record.count.parentNode.setAttribute("data-complete", complete ? "true" : "false");
    record.count.parentNode.querySelector(".progress-fill").style.width =
      (record.total ? Math.round((shown / record.total) * 100) : 0) + "%";
    record.card.classList.toggle("has-match", shown !== 0);
  }

  function totalCommands() {
    return CMD_GROUPS.reduce(function (sum, group) { return sum + group.commands.length; }, 0);
  }

  function filterCommands() {
    var query = cmdSearch.value.trim().toLowerCase();
    var shown = 0;
    cardEntries.forEach(function (record) {
      applyCardFilter(record);
      if (!record.card.hidden) {
        rowIndex.forEach(function (entry) {
          if (entry.section === record.toggle && !entry.node.hidden) shown += 1;
        });
      }
      if (query) setOpen(record, true, false);
      else setOpen(record, record.userOpen === true, false);
    });
    cmdEmpty.hidden = shown !== 0;
    cmdStatus.textContent = query
      ? shown + " of " + totalCommands() + " commands match."
      : totalCommands() + " commands in " + CMD_GROUPS.length + " boxes";
  }

  cmdSearch.addEventListener("input", filterCommands);
  cmdSearch.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && cmdSearch.value) {
      event.preventDefault();
      cmdSearch.value = "";
      filterCommands();
    }
  });
  cmdClear.addEventListener("click", function () {
    cmdSearch.value = "";
    filterCommands();
    cmdSearch.focus();
  });
  filterCommands();

  /* keep dialog body from scrolling the page underneath on some browsers */
  document.documentElement.style.overflowAnchor = "none";
})();
