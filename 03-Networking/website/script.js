/* ============================================================
   NETWORKING — standalone interactive networking field guide
   No libraries, no network calls: everything runs in this file.
   ============================================================ */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pad = (n, len = 2) => String(n).padStart(len, '0');
const clockStamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2100);
}

/* ------------------------------------------------------------
   1. CONCEPT DATA
   ------------------------------------------------------------ */
const CONCEPTS = [
  { id:'ip', n:'01', title:'IP address', group:'Addressing', demo:'ip',
    hook:'A routable location, not a permanent identity. Change networks and the location changes with you.',
    body:'An IP is the address routers use to decide where a packet should go next. Private ranges exist inside homes and offices; a public address represents the whole building to the outside world. IPv4 is running out of room, so IPv6 expands the address space dramatically and restores end-to-end reachability.',
    field:'Hotel Wi-Fi gives your phone a different private address than your home Wi-Fi — yet both sessions appear to a site as the building’s public address.',
    facts:[['Looks like','192.168.1.24 / 2001:db8::42'],['Scope','Private ≠ secret; it only means “not routable on the public internet”']],
    cmd:'ip addr show   # or: ipconfig /all' },
  { id:'dns', n:'02', title:'DNS', group:'Naming', demo:'dns',
    hook:'The internet’s address book: humans keep names, machines keep numbers, and caches keep things fast.',
    body:'A resolver hunts down the record for a hostname, usually from a local cache, then a recursive resolver, then the authoritative zone. Answers carry a TTL, which is why a freshly changed record can take time to reach everyone. Records come in flavours: A/AAAA for addresses, CNAME for aliases, MX for mail, TXT for verification.',
    field:'Moving a site to a new host feels instant to you but slow to some visitors because their resolver is still holding the old address until the TTL expires.',
    facts:[['Runs on','UDP/53 usually; TCP/53 for large replies'],['Try','dig +trace atlas.example']],
    cmd:'dig atlas.example A +short' },
  { id:'ports', n:'03', title:'Ports', group:'Addressing', demo:'ports',
    hook:'One machine, many conversations. A port number is the apartment number inside the address.',
    body:'An IP gets a packet to a host; a port tells the operating system which program should receive it. Well-known numbers are conventions, not laws — 443 for HTTPS, 53 for DNS, 22 for SSH — while ephemeral ports are temporarily assigned to your side of each connection.',
    field:'A web app failing with “EADDRINUSE” means another process already claimed the port your server wanted.',
    facts:[['Range','0–65535; 49152+ typically ephemeral'],['Pair','src IP:port + dst IP:port identifies a flow']],
    cmd:'ss -tulnp   # or: netstat -an' },
  { id:'mac', n:'04', title:'MAC address', group:'Addressing', demo:'mac',
    hook:'The hardware label used for the very next hop — it does not travel across the internet.',
    body:'A MAC address identifies a network interface on a local segment. Ethernet frames rewrite these addresses at every router, so the destination MAC usually belongs to the next hop, not the faraway server. The first half hints at the manufacturer; modern systems often randomise it for privacy on public Wi-Fi.',
    field:'Airport Wi-Fi sees a rotating randomised MAC, which is why the captive portal may treat your laptop as a brand-new device the next day.',
    facts:[['Shape','6 hex pairs, e.g. 3a:7f:0c:21:9b:4e'],['Scope','One local network segment']],
    cmd:'ip link show   # look for "link/ether"' },
  { id:'arp', n:'05', title:'ARP', group:'Addressing', demo:'arp',
    hook:'“Who owns this local IP?” shouted to the room, answered by exactly one neighbour.',
    body:'Before an Ethernet frame can be built, the sender needs the link-layer address matching the next-hop IP. ARP broadcasts a question on the local network and caches the reply. IPv6 replaces the broadcast approach with Neighbour Discovery using multicast.',
    field:'A duplicate IP on a small office LAN makes ARP answers fight each other, so the same workstation flickers between connected and unreachable.',
    facts:[['Lives at','Between network and link layers'],['Cache','arp -a shows recent neighbours']],
    cmd:'arp -a' },
  { id:'routing', n:'06', title:'Routing', group:'Delivery', demo:'routing',
    hook:'No one knows the whole road. Each router only needs to know the best next turn.',
    body:'Routers consult a forwarding table: a specific prefix beats a general one, and a default route catches everything else. Across providers, BGP exchanges reachable prefixes and policies, so your packet may take a different path tomorrow than it did today.',
    field:'A VPN “works” but a video call routes through another country because the tunnel advertises a shorter-looking path.',
    facts:[['Rule','Longest prefix match wins'],['Tool','traceroute / tracert reveals hops']],
    cmd:'traceroute atlas.example' },
  { id:'nat', n:'07', title:'NAT', group:'Delivery', demo:'nat',
    hook:'One public address, a whole household of devices: a translation table makes the return trip possible.',
    body:'A home router rewrites private source addresses and ports into one public address with unique external ports. When replies arrive, the table maps them back. That statefulness is convenient for outbound traffic but makes inbound connections awkward without port forwarding or a relay.',
    field:'Two people in the same house play the same online game without conflicts because each session gets a different external port.',
    facts:[['Full name','Network Address Translation / PAT'],['Side effect','Inbound hosting needs explicit rules']],
    cmd:'sudo iptables -t nat -L -n -v' },
  { id:'subnet', n:'08', title:'Subnetting', group:'Addressing', demo:'subnet',
    hook:'A prefix length draws the line between “right here” and “send it to the router”.',
    body:'A subnet mask splits an address into a network portion and a host portion. Comparing your own network bits with the destination tells the device whether to use ARP locally or hand the packet to a gateway. CIDR notation is just a compact way of writing that split.',
    field:'Splitting a /24 office LAN into smaller VLANs keeps printer broadcasts from crowding the video-conferencing traffic.',
    facts:[['Example','/24 = 254 usable hosts'],['Reserved','Network + broadcast addresses']],
    cmd:'ipcalc 192.168.1.0/24' },
  { id:'dhcp', n:'09', title:'DHCP', group:'Addressing', demo:'dhcp',
    hook:'Joining a network should not require a form. A short four-message negotiation hands you a working configuration.',
    body:'A client asks for configuration, a server offers one, the client accepts, and the server acknowledges. The lease bundles an IP, mask, default gateway, DNS servers and an expiry timer. When the lease is halfway through, the client quietly asks to renew it.',
    field:'Conference Wi-Fi collapses at keynote time when the address pool is a /24 but 900 people arrive — nobody gets an offer.',
    facts:[['Handshake','Discover → Offer → Request → Ack'],['Lease','Borrowed, not owned']],
    cmd:'ipconfig /renew   # or: sudo dhclient -v' },
  { id:'tcp', n:'10', title:'TCP', group:'Transport', demo:'tcp',
    hook:'Turn an unreliable stream of packets into an ordered, complete, courteous conversation.',
    body:'TCP numbers every byte, acknowledges what arrived, retransmits what went missing, and adjusts its sending rate to avoid flattening the network. That reliability is why file transfers, APIs and web pages lean on it — and why head-of-line blocking can make one lost segment stall everything behind it.',
    field:'A flaky train Wi-Fi makes a large upload crawl rather than corrupt: the sender keeps shrinking its window and retrying missing pieces.',
    facts:[['Guarantees','Order, integrity, delivery'],['Costs','Setup + retransmission latency']],
    cmd:'ss -ti   # inspect congestion state' },
  { id:'handshake', n:'11', title:'Three-way handshake', group:'Transport', demo:'handshake',
    hook:'Two “can you hear me?” messages and one “yes, let’s talk” before any real data moves.',
    body:'The client sends a SYN with its starting sequence number, the server replies SYN-ACK with its own, and the client confirms with ACK. Both sides now agree on sequence space and connection state. Closing has its own choreography of FIN and ACK messages.',
    field:'A health check that reports “port open” but an app still fails may be seeing a completed handshake with a broken service behind it.',
    facts:[['Packets','SYN → SYN-ACK → ACK'],['State','ESTABLISHED after the third']],
    cmd:'tcpdump -n "tcp[tcpflags] & tcp-syn != 0"' },
  { id:'tls', n:'12', title:'HTTPS & TLS', group:'Trust', demo:'tls',
    hook:'Encryption is only half the story. The other half is proving you are really talking to the right name.',
    body:'A TLS handshake authenticates the server with a certificate, agrees on a cipher suite, and derives session keys. Traffic afterwards is encrypted and integrity-checked. TLS 1.3 trims the round trips, and certificate validity depends on your device clock being sane.',
    field:'A laptop with a dead CMOS battery shows “your clock is behind” and then rejects every HTTPS site, even healthy ones.',
    facts:[['Default port','443'],['Protects','Confidentiality + identity + tampering']],
    cmd:'openssl s_client -connect atlas.example:443' },
  { id:'http', n:'13', title:'HTTP', group:'Transport', demo:'http',
    hook:'A structured question and a structured answer: method, path, headers, body — then status and payload.',
    body:'Requests carry intent (GET, POST, PUT…), metadata and optionally a body. Responses carry a status class: 2xx success, 3xx redirect, 4xx client problem, 5xx server problem. Caching, cookies and content negotiation all live in headers, not in the page itself.',
    field:'A checkout button that double-charges is often a retry of a non-idempotent POST after the browser lost the first response.',
    facts:[['Versions','HTTP/1.1, /2 multiplexing, /3 over QUIC'],['Inspect','DevTools → Network']],
    cmd:'curl -i https://atlas.example' },
  { id:'lb', n:'14', title:'Load balancer', group:'Infrastructure', demo:'lb',
    hook:'A traffic conductor at the front door: spread work, skip anything unhealthy, keep one public address.',
    body:'A balancer distributes connections across a pool using round-robin, least-connections or hashing, while health checks evict broken members. It may also terminate TLS and keep connections warm so application servers do less work. Session affinity is a deliberate trade-off, not a default.',
    field:'During a product launch, one extra server joins the pool and average response time drops without a single DNS change.',
    facts:[['Algorithms','Round-robin / least-conn / consistent hash'],['Checks','/healthz decides membership']],
    cmd:'curl -s https://atlas.example/healthz' },
  { id:'proxy', n:'15', title:'Reverse proxy', group:'Infrastructure', demo:'proxy',
    hook:'One doorway, many rooms behind it. The proxy decides which internal service sees each request.',
    body:'Sitting in front of applications, a reverse proxy routes by path or hostname, terminates TLS, compresses responses, serves static assets, applies rate limits and hides internal topology. A forward proxy does the mirror image: it represents clients leaving a network.',
    field:'A single domain can serve the marketing site, the /api routes and the image cache from three completely different backends.',
    facts:[['Common','NGINX, HAProxy, Caddy, Envoy'],['Bonus','Central place for auth + rate limits']],
    cmd:'curl -I https://atlas.example/api/orders' },
  { id:'firewall', n:'16', title:'Firewall', group:'Trust', demo:'firewall',
    hook:'A bouncer with a written list. Packets that don’t match the policy simply never get a reply.',
    body:'Rules evaluate addresses, ports, protocols and connection state. Stateful firewalls remember outbound flows and allow their return traffic automatically. A silent drop produces a timeout, while an explicit reject produces an immediate refusal — an important diagnostic difference.',
    field:'A database reachable locally but not from the app server is usually a security-group rule for port 5432, not broken code.',
    facts:[['Drop vs reject','Timeout vs connection refused'],['Layers','Network ACLs + host firewalls']],
    cmd:'sudo ufw status verbose' },
  { id:'ws', n:'17', title:'WebSockets', group:'Transport', demo:'ws',
    hook:'A request that turns into a standing phone line: either side can speak whenever it needs to.',
    body:'The connection starts as an ordinary HTTP request with an Upgrade header, then stays open as a full-duplex frame channel. That removes polling overhead for chat, dashboards and collaborative editors. Long-lived connections still need heartbeats, reconnect logic and proxy timeout tuning.',
    field:'A stock ticker updates 20 times a second without 20 separate HTTP requests because the socket is already open.',
    facts:[['Starts as','HTTP/1.1 Upgrade: websocket'],['Scheme','ws:// or wss://']],
    cmd:'curl -i -N -H "Upgrade: websocket" ...' },
  { id:'udp', n:'18', title:'UDP', group:'Transport', demo:'udp',
    hook:'Postcards instead of registered mail: tiny, fast, and nobody promises they arrived.',
    body:'UDP adds only ports, length and a checksum to IP — no handshake, no ordering, no retries. Real-time media prefers it because a late frame is a useless frame. QUIC builds reliability and encryption on top of UDP, giving HTTP/3 fast startup without TCP’s head-of-line blocking.',
    field:'A video call keeps going with a brief frozen pixel block rather than pausing everyone to recover one old frame.',
    facts:[['Used by','DNS, voice/video, QUIC'],['Trade','Speed for no delivery guarantee']],
    cmd:'sudo tcpdump -n udp port 53' },
  { id:'osi', n:'19', title:'OSI model', group:'Maps', demo:'osi',
    hook:'Seven shelves for the same problem: each one solves a slice and hands the result to the next.',
    body:'The model is a shared vocabulary rather than software you install. Layers 1–3 move bits and packets, layer 4 manages conversations, and 5–7 handle sessions, representation and application meaning. When something breaks, naming the layer narrows the search immediately.',
    field:'“The site is slow” becomes a solvable question once you decide whether the delay is DNS, TCP, TLS or the application.',
    facts:[['Mnemonic','Physical → Data → Network → Transport → Session → Presentation → Application'],['Reality','TCP/IP collapses some layers']],
    cmd:'# use the live stack below this section' },
  { id:'recap', n:'20', title:'One request, whole stack', group:'Maps', demo:'recap',
    hook:'Everything above shows up in one page load. The trick is knowing which piece to blame when it doesn’t.',
    body:'A click triggers a lease check, name lookup, local-delivery decision, address translation, routing, policy checks, handshake, encryption, request routing and rendering. Each step leaves a distinguishable trace: a status code, a timeout, a DNS error or a certificate warning.',
    field:'A blank page with a spinner and no console errors is often a network stall — DevTools timing columns show exactly which phase is stuck.',
    facts:[['Map','Symptom → layer → smallest test'],['Shortcut','The final lab animates all 20 together']],
    cmd:'curl -w "%{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer}\\n" -o /dev/null -s https://atlas.example' }
];
const GROUPS = ['All', 'Addressing', 'Naming', 'Delivery', 'Transport', 'Trust', 'Infrastructure', 'Maps'];

/* ------------------------------------------------------------
   2. MINI LAB MARKUP + BEHAVIOURS
   ------------------------------------------------------------ */
const portState = { 22:'closed', 53:'open', 80:'open', 443:'open', 3306:'closed', 8080:'closed' };
const ruleState = { 22:'deny', 443:'allow', 3306:'deny' };
const seqTokens = {};
const miniTimers = {};
function initialOut(type) {
  const idle = 'Press the control to watch this idea run.';
  const map = {
    ip: '<div class="mini-line"><span>Enter an IPv4 address</span><b class="info">IPv4</b></div><div class="mini-line"><span>We’ll classify its scope</span><b>—</b></div>',
    ports: '<div class="mini-line"><span>Click a port to open/close its listener</span></div>',
    subnet: '<div class="mini-line"><span>Drag the prefix length</span><b class="info">/24</b></div>',
    firewall: '<div class="mini-line"><span>Click a rule to flip it, then probe</span></div>',
    ws: '<div class="mini-line"><span>Socket</span><b class="bad">CLOSED</b></div>',
    recap: '<div class="mini-line"><span>All 20 concepts, one run</span><b class="vio">READY</b></div>'
  };
  return map[type] || `<div class="mini-line"><span>${idle}</span><b class="info">READY</b></div>`;
}
function controls(c) {
  const open = (label = 'Run') => `<button class="mini-btn" type="button" data-action="mini" data-demo="${c.demo}">${label}</button>`;
  switch (c.demo) {
    case 'ip': return `<input class="mini-input" data-input="ip" value="192.168.1.24" aria-label="IPv4 address">${open('Inspect')}`;
    case 'ports': return `<span class="small" style="color:var(--dim)">Select a port to toggle its listener</span>`;
    case 'subnet': return `<input type="range" min="24" max="30" value="24" data-input="cidr" aria-label="CIDR prefix length" style="flex:1;min-width:120px"><span class="mono small" data-cidr-label>/24</span>`;
    case 'http': return `<select class="mini-select" aria-label="HTTP method" data-input="method"><option>GET</option><option>POST</option><option>HEAD</option><option>DELETE</option></select><input class="mini-input" data-input="path" value="/dashboard" aria-label="Request path">${open('Send')}`;
    case 'proxy': return `<select class="mini-select" aria-label="Proxy route" data-input="route"><option>/</option><option>/api/orders</option><option>/assets/logo.svg</option></select>${open('Route')}`;
    case 'firewall': return `<button class="mini-btn" type="button" data-action="mini" data-demo="firewall">Probe rules</button>`;
    case 'ws': return open('Open channel');
    case 'recap': return `<button class="mini-btn" type="button" data-action="goLab">Run the full lab</button>`;
    case 'dns': return open('Resolve name');
    case 'mac': return open('New device');
    case 'arp': return open('Ask the LAN');
    case 'routing': return open('Trace hops');
    case 'nat': return open('Send packet');
    case 'dhcp': return open('Join network');
    case 'tcp': return open('Send 5 segments');
    case 'handshake': return open('Connect');
    case 'tls': return open('Secure channel');
    case 'lb': return open('Send 6 requests');
    case 'udp': return open('Stream frames');
    case 'osi': return open('Wrap message');
    default: return open();
  }
}
let currentConcept = 'ip';
function renderLesson(id) {
  const c = CONCEPTS.find(item => item.id === id);
  currentConcept = id;
  Object.keys(miniTimers).forEach(key => {
    clearInterval(miniTimers[key]);
    delete miniTimers[key];
  });
  Object.keys(seqTokens).forEach(key => delete seqTokens[key]);
  const pane = $('#conceptGrid');
  pane.hidden = !c;
  if (!c) {
    pane.replaceChildren();
    return;
  }
  $$('#conceptList button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.lesson === id));
  });
  $('#conceptPicker').value = id;
  pane.innerHTML = `
    <article class="concept-card" data-concept="${c.id}" aria-labelledby="lessonTitle">
      <div class="lesson-meta"><span class="lesson-number">${c.n}</span><span>${esc(c.group)}</span></div>
      <h3 id="lessonTitle">${esc(c.title)}</h3>
      <p class="concept-hook">${esc(c.hook)}</p>
      <div class="mini-lab">
        <h4 class="mini-head">Experiment</h4>
        <div class="mini-controls">${controls(c)}</div>
        <div class="mini-out" data-out="${c.id}">${initialOut(c.demo)}</div>
      </div>
      <div class="field-note"><h4>In practice</h4><p>${esc(c.field)}</p></div>
      <details class="concept-more">
        <summary>Technical details and command</summary>
        <div class="concept-detail"><p>${esc(c.body)}</p>
          <dl class="detail-grid">${c.facts.map(([key,value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
          <div class="command-line"><code>${esc(c.cmd)}</code><button class="copy-cmd" type="button" data-copy="${esc(c.cmd)}">Copy</button></div>
        </div>
      </details>
    </article>`;
  const card = $('.concept-card', pane);
  if (id === 'firewall') renderRules($('.mini-out', card));
  if (id === 'ports' || id === 'subnet') runMini(id, card);
}
function renderConcepts() {
  const group = $('#conceptGroup').value;
  const query = $('#conceptSearch').value.trim().toLowerCase();
  const matches = CONCEPTS.filter(c =>
    (group === 'All' || c.group === group) &&
    [c.title, c.group, c.hook, c.body, c.field, c.cmd].join(' ').toLowerCase().includes(query)
  );
  $('#conceptList').innerHTML = matches.map(c => `
    <button type="button" data-lesson="${c.id}" aria-controls="conceptGrid">
      <span class="index-number">${c.n}</span><span>${esc(c.title)}</span>
      <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>
    </button>`).join('');
  $('#conceptPicker').innerHTML = matches.map(c =>
    `<option value="${c.id}">${c.n} · ${esc(c.title)}</option>`).join('');
  $('#conceptPicker').disabled = matches.length === 0;
  $('#conceptCount').textContent = `${matches.length} ${matches.length === 1 ? 'concept' : 'concepts'}`;
  $('#conceptEmpty').hidden = matches.length !== 0;
  renderLesson(matches.some(c => c.id === currentConcept) ? currentConcept : matches[0]?.id);
}
function initConceptIndex() {
  $('#conceptGroup').innerHTML = GROUPS.map(group =>
    `<option value="${group}">${group === 'All' ? 'All topics' : group}</option>`).join('');
  $('#conceptGroup').addEventListener('change', renderConcepts);
  $('#conceptSearch').addEventListener('input', renderConcepts);
  $('#conceptList').addEventListener('click', event => {
    const entry = event.target.closest('[data-lesson]');
    if (entry && entry.dataset.lesson !== currentConcept) renderLesson(entry.dataset.lesson);
  });
  $('#conceptPicker').addEventListener('change', event => renderLesson(event.target.value));
  $('#clearSearch').addEventListener('click', () => {
    $('#conceptGroup').value = 'All';
    $('#conceptSearch').value = '';
    renderConcepts();
    $('#conceptSearch').focus();
  });
  renderConcepts();
}
function renderPorts(out) {
  const services = { 22:'SSH', 53:'DNS', 80:'HTTP', 443:'HTTPS', 3306:'MySQL', 8080:'Dev server' };
  out.innerHTML = `<div class="mini-line"><span>Listener table · tcp/udp</span><b class="info">6 PORTS</b></div>
    <div class="mini-chips" style="margin-top:7px">${Object.keys(portState).map(p =>
      `<button type="button" aria-pressed="${portState[p] === 'open'}" class="mini-chip ${portState[p] === 'open' ? 'is-active' : ''}" data-action="port" data-port="${p}" title="${services[p]}">:${p} ${portState[p] === 'open' ? 'open' : 'closed'}</button>`).join('')}</div>
    <div class="mini-line" style="margin-top:7px"><span>Open listeners</span><b class="ok">${Object.values(portState).filter(v => v === 'open').length} / 6</b></div>`;
}
function renderRules(out) {
  out.innerHTML = `<div class="mini-line"><span>Edge policy · inbound</span><b class="info">3 RULES</b></div>
    <div class="mini-chips" style="margin-top:7px">${Object.keys(ruleState).map(p =>
      `<button type="button" aria-pressed="${ruleState[p] === 'allow'}" class="mini-chip ${ruleState[p] === 'allow' ? 'is-active' : 'is-blocked'}" data-action="rule" data-port="${p}">:${p} ${ruleState[p]}</button>`).join('')}</div>`;
}
function runSeq(key, out, lines, delay = 230) {
  const token = {};
  seqTokens[key] = token;
  out.innerHTML = '';
  lines.forEach((line, i) => setTimeout(() => {
    if (seqTokens[key] !== token) return;
    out.insertAdjacentHTML('beforeend', `<div class="mini-line">${line}</div>`);
    out.scrollTop = out.scrollHeight;
  }, i * delay));
}
function randomMac() {
  const h = () => pad(rand(0, 255).toString(16), 2);
  return `${h()}:${h()}:${h()}:${h()}:${h()}:${h()}`.toUpperCase();
}
function privateInfo(ip) {
  const o = ip.split('.').map(Number);
  if (o[0] === 127) return ['LOOPBACK', 'Traffic never leaves this machine', 'info'];
  if (o[0] === 10 || (o[0] === 192 && o[1] === 168) || (o[0] === 172 && o[1] >= 16 && o[1] <= 31)) return ['PRIVATE', 'Needs NAT to reach the public web', 'ok'];
  if (o[0] === 169 && o[1] === 254) return ['LINK-LOCAL', 'DHCP probably failed (APIPA)', 'warn'];
  return ['PUBLIC', 'Reachable at routing level', 'vio'];
}
function runMini(type, card) {
  const out = $('.mini-out', card);
  const id = card.dataset.concept;
  const inp = (name) => $(`[data-input="${name}"]`, card);
  switch (type) {
    case 'ip': {
      const value = inp('ip').value.trim();
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(value) || value.split('.').some(n => Number(n) > 255)) {
        out.innerHTML = `<div class="mini-line"><span>Not a valid IPv4 address</span><b class="bad">REJECT</b></div><div class="mini-line"><span>Try 8.8.8.8 or 10.0.0.5</span></div>`;
        return;
      }
      const [kind, note, cls] = privateInfo(value);
      runSeq(id, out, [
        `<span>Input</span><b>${esc(value)}</b>`,
        `<span>Octet 1 in binary</span><b>${pad(Number(value.split('.')[0]).toString(2), 8)}</b>`,
        `<span>Classification</span><b class="${cls}">${kind}</b>`,
        `<span>${note}</span><b class="ok">✓</b>`]);
      break;
    }
    case 'dns': runSeq(id, out, [
      `<span>Browser cache</span><b class="warn">MISS</b>`,
      `<span>Recursive resolver</span><b class="info">QUERY A</b>`,
      `<span>Root → .example zone</span><b class="info">REFERRAL</b>`,
      `<span>Authoritative answer</span><b class="ok">203.0.113.42</b>`,
      `<span>Cached for</span><b>TTL 300s</b>`], 280); break;
    case 'ports': renderPorts(out); break;
    case 'mac': {
      const mac = randomMac();
      runSeq(id, out, [
        `<span>New interface</span><b>eth0</b>`,
        `<span>OUI (vendor half)</span><b class="info">${mac.slice(0, 8)}</b>`,
        `<span>Device half</span><b>${mac.slice(9)}</b>`,
        `<span>Frame destination</span><b class="ok">next hop only</b>`], 180); break;
    }
    case 'arp': runSeq(id, out, [
      `<span>Broadcast</span><b class="warn">WHO HAS 192.168.1.1?</b>`,
      `<span>Gateway replies</span><b class="info">I DO · 3a:7f:0c…</b>`,
      `<span>ARP cache</span><b class="ok">192.168.1.1 → 3A:7F:0C:21:9B:4E</b>`,
      `<span>Ethernet frame</span><b class="ok">READY TO SEND</b>`], 300); break;
    case 'routing': runSeq(id, out, [
      `<span>hop 1 · home gateway</span><b>1 ms</b>`,
      `<span>hop 2 · ISP access</span><b>8 ms</b>`,
      `<span>hop 3 · metro peering</span><b>14 ms</b>`,
      `<span>hop 4 · transit provider</span><b>27 ms</b>`,
      `<span>hop 5 · edge network</span><b class="ok">38 ms</b>`], 260); break;
    case 'nat': {
      const p = rand(40000, 60000);
      runSeq(id, out, [
        `<span>Inside</span><b>192.168.1.24:${p}</b>`,
        `<span>Rewrite source</span><b class="info">198.51.100.7:${p}</b>`,
        `<span>Translation table</span><b class="ok">ENTRY ADDED</b>`,
        `<span>Reply returns</span><b class="ok">MAPPED BACK TO .24</b>`], 260); break;
    }
    case 'subnet': {
      const bits = Number(inp('cidr').value);
      const hosts = Math.pow(2, 32 - bits) - 2;
      $('[data-cidr-label]', card).textContent = `/${bits}`;
      out.innerHTML = `<div class="mini-line"><span>Network</span><b>192.168.1.0/${bits}</b></div>
        <div class="mini-line"><span>Mask</span><b class="info">${bits} network bits / ${32 - bits} host bits</b></div>
        <div class="mini-line"><span>Usable hosts</span><b class="ok">${hosts}</b></div>
        <div class="mini-line"><span>First → last</span><b>192.168.1.1 → 192.168.1.${hosts}</b></div>
        <div class="mini-bar"><i style="width:${Math.min(100, hosts / 254 * 100)}%"></i></div>`;
      break;
    }
    case 'dhcp': runSeq(id, out, [
      `<span>DISCOVER</span><b class="warn">broadcast · who can configure me?</b>`,
      `<span>OFFER</span><b class="info">192.168.1.24 /24</b>`,
      `<span>REQUEST</span><b class="info">I’ll take that one</b>`,
      `<span>ACK</span><b class="ok">gateway .1 · dns 1.1.1.1 · lease 24h</b>`], 320); break;
    case 'tcp': runSeq(id, out, [
      `<span>segments 1, 2, 3</span><b class="ok">ACKed</b>`,
      `<span>segment 4</span><b class="bad">LOST IN TRANSIT</b>`,
      `<span>receiver queue</span><b class="warn">GAP DETECTED</b>`,
      `<span>retransmit #4</span><b class="info">TIMER FIRED</b>`,
      `<span>delivered to app</span><b class="ok">1 · 2 · 3 · 4 · 5 in order</b>`], 320); break;
    case 'handshake': runSeq(id, out, [
      `<span>client → server</span><b class="warn">SYN seq=1000</b>`,
      `<span>server → client</span><b class="info">SYN-ACK seq=5000 ack=1001</b>`,
      `<span>client → server</span><b class="ok">ACK ack=5001</b>`,
      `<span>connection state</span><b class="ok">ESTABLISHED</b>`], 380); break;
    case 'tls': {
      const cipher = Array.from({ length: 12 }, () => rand(0, 15).toString(16)).join('').toUpperCase();
      runSeq(id, out, [
        `<span>ClientHello</span><b class="info">TLS 1.3 + supported ciphers</b>`,
        `<span>Certificate</span><b class="ok">chain trusted · name matches</b>`,
        `<span>Key agreement</span><b class="vio">session keys derived</b>`,
        `<span>Wire bytes</span><b>${cipher}…</b>`,
        `<span>Plain HTTP inside</span><b class="ok">HIDDEN FROM EAVESDROPPERS</b>`], 320); break;
    }
    case 'http': {
      const method = inp('method').value, path = inp('path').value || '/';
      const status = method === 'DELETE' ? '204 No Content' : method === 'POST' ? '201 Created' : '200 OK';
      runSeq(id, out, [
        `<span>Request</span><b class="info">${esc(method)} ${esc(path)} HTTP/2</b>`,
        `<span>Headers</span><b>host · accept · cookie</b>`,
        `<span>Server work</span><b>route → handler → render</b>`,
        `<span>Response</span><b class="ok">${status}</b>`,
        `<span>Body</span><b class="ok">${method === 'HEAD' ? 'none (headers only)' : 'HTML / JSON payload'}</b>`], 260); break;
    }
    case 'lb': {
      const servers = ['app-a', 'app-b', 'app-c'];
      const lines = servers.map((s, i) => `<span>req ${i + 1} &amp; ${i + 4}</span><b class="${i === 1 ? 'vio' : 'ok'}">→ ${s} · 200</b>`);
      lines.push(`<span>health check</span><b class="ok">3 / 3 healthy · no affinity</b>`);
      runSeq(id, out, lines, 300); break;
    }
    case 'proxy': {
      const route = inp('route').value;
      const target = route.startsWith('/api') ? 'orders-service:9000' : route.startsWith('/assets') ? 'object cache / CDN' : 'web-renderer:3000';
      runSeq(id, out, [
        `<span>Incoming path</span><b class="info">${esc(route)}</b>`,
        `<span>TLS terminated</span><b>at the edge</b>`,
        `<span>Route matched</span><b class="vio">${target}</b>`,
        `<span>Upstream reply</span><b class="ok">200 · compressed</b>`], 260); break;
    }
    case 'firewall': {
      const lines = Object.entries(ruleState).map(([p, state]) =>
        `<span>probe :${p}</span><b class="${state === 'allow' ? 'ok' : 'bad'}">${state === 'allow' ? 'ACCEPT' : 'DROP / timeout'}</b>`);
      lines.push(`<span>stateful return flow</span><b class="ok">ALLOWED</b>`);
      runSeq(id, out, lines, 260); break;
    }
    case 'ws': {
      if (miniTimers[id]) {
        clearInterval(miniTimers[id]); miniTimers[id] = null;
        out.innerHTML = `<div class="mini-line"><span>Socket</span><b class="bad">CLOSED</b></div><div class="mini-line"><span>Frames received</span><b>session ended</b></div>`;
        $('.mini-btn', card).textContent = 'Open channel';
        return;
      }
      let n = 0;
      $('.mini-btn', card).textContent = 'Close channel';
      out.innerHTML = `<div class="mini-line"><span>Upgrade</span><b class="ok">101 SWITCHING PROTOCOLS</b></div>`;
      miniTimers[id] = setInterval(() => {
        n++;
        out.insertAdjacentHTML('beforeend', `<div class="mini-line"><span>frame #${pad(n)} · ${['price', 'cursor', 'presence', 'chat'][n % 4]}</span><b class="info">${rand(40, 210)} bytes</b></div>`);
        if ($$('.mini-line', out).length > 6) $('.mini-line', out).remove();
        out.scrollTop = out.scrollHeight;
      }, 720);
      break;
    }
    case 'udp': {
      let lost = 0, got = 0;
      const lines = [`<span>source</span><b class="info">UDP :53 → :51000</b>`];
      for (let i = 1; i <= 10; i++) {
        if ([3, 8].includes(i)) { lost++; lines.push(`<span>datagram ${i}</span><b class="bad">LOST</b>`); }
        else { got++; lines.push(`<span>datagram ${i}</span><b class="ok">delivered (${rand(4, 22)} ms)</b>`); }
      }
      lines.push(`<span>Result</span><b class="warn">${got}/10 · NO RETRANSMIT</b>`);
      runSeq(id, out, lines, 190); break;
    }
    case 'osi': {
      const names = ['HTTP', 'TLS', 'Session', 'TCP', 'IP', 'Ethernet', 'Bits'];
      runSeq(id, out, names.map((x, i) => `<span>L${7 - i}</span><b class="${i === 6 ? 'ok' : 'info'}">+ ${x} header</b>`)
        .concat([`<span>Wire</span><b class="ok">10110100… ↗</b>`]), 210); break;
    }
  }
}

/* ------------------------------------------------------------
   3. LIVE OSI STACK
   ------------------------------------------------------------ */
const LAYERS = [
  { n:7, name:'Application', sub:'HTTP, DNS, WebSocket', pdu:'DATA', wrap:'Adds the request: method, host and headers.' },
  { n:6, name:'Presentation', sub:'TLS, encoding, compression', pdu:'DATA', wrap:'Encrypts and formats the payload for the peer.' },
  { n:5, name:'Session', sub:'dialog + reconnection state', pdu:'DATA', wrap:'Tags the conversation so both sides can resume it.' },
  { n:4, name:'Transport', sub:'TCP segments / UDP datagrams', pdu:'SEGMENT', wrap:'Adds source and destination ports plus sequence numbers.' },
  { n:3, name:'Network', sub:'IP packets + routing', pdu:'PACKET', wrap:'Adds logical source and destination addresses.' },
  { n:2, name:'Data Link', sub:'Ethernet frames + MAC', pdu:'FRAME', wrap:'Adds next-hop MAC addresses and a frame check sequence.' },
  { n:1, name:'Physical', sub:'cables, radio, light', pdu:'BITS', wrap:'Turns the frame into electrical, radio or optical signals.' }
];
let osiSteps = [], osiIndex = 0, osiTimer = null, osiPlaying = false, osiFlipped = false;
function buildOsiSteps() {
  const down = LAYERS.map((l, i) => ({
    kind:'down', layer:i, phase:'ENCAPSULATING', icon:'↓', title:`Layer ${l.n} · ${l.name}`,
    desc:l.wrap, chips:[...LAYERS.slice(0, i + 1).map(x => ({ t: `L${x.n} ${x.name.split(' ')[0]}`, c:'head' })), { t:'YOUR MESSAGE', c:'data' }],
    log:`↓ L${l.n} adds ${l.name} header · PDU ${l.pdu}`
  }));
  const wire = { kind:'wire', layer:-1, phase:'ON THE WIRE', icon:'⇄', title:'Signals cross the medium', desc:'Routers read the network header, switches read the link header, and the payload stays wrapped until it reaches the peer.', chips:[{ t:'10110100', c:'data' }, { t:'01101011', c:'data' }, { t:'11010010', c:'data' }, { t:'FCS', c:'trailer' }], log:'⇄ bits traverse switches, routers and links' };
  const up = LAYERS.slice().reverse().map((l, j) => {
    const idx = 6 - j;
    return { kind:'up', layer:idx, phase:'DECAPSULATING', icon:'↑', title:`Layer ${l.n} · ${l.name}`,
      desc:`Checks and removes the ${l.name} wrapper, then passes the remainder up.`,
      chips:[...LAYERS.slice(0, idx + 1).map(x => ({ t:`L${x.n}`, c:'head' })), { t:'PAYLOAD', c:'data' }],
      log:`↑ L${l.n} removes its header · hands up` };
  });
  osiSteps = [...down, wire, ...up];
}
function initOsi() {
  $('#osiStack').innerHTML = LAYERS.map((l, i) => `
    <div class="osi-layer" data-layer="${i}">
      <span class="layer-num">L${l.n}</span>
      <span class="layer-name">${l.name}<small>${l.sub}</small></span>
      <span class="layer-pdu">${l.pdu}</span><span class="layer-dot"></span>
    </div>`).join('');
  buildOsiSteps();
  renderOsiStep(osiSteps[0], 0, true);
  $$('.osi-layer').forEach(row => row.classList.remove('is-active', 'is-done'));
  $('#osiPhase').textContent = 'IDLE';
  $('#osiStep').textContent = '00 / 15';
  $('#osiHeadline').textContent = 'Ready to send';
  $('#osiDescription').textContent = 'Press “Send a message” to watch headers get added and removed in real time.';
  $('#osiPdu').innerHTML = '<span class="data">YOUR MESSAGE</span>';
  $('#osiProgressBar').style.width = '0%';
  $('#wireLabel').textContent = 'Bits on the wire';
}
function logOsi(text) {
  const log = $('#osiLog');
  log.insertAdjacentHTML('beforeend', `<div><span class="t">${clockStamp()}</span> ${esc(text)}</div>`);
  while (log.children.length > 26) log.firstElementChild.remove();
  log.scrollTop = log.scrollHeight;
}
function renderOsiStep(step, index, silent = false) {
  $$('.osi-layer').forEach((row, i) => {
    row.classList.toggle('is-active', i === step.layer);
    row.classList.toggle('is-done', step.kind === 'down' ? i < step.layer : i > step.layer);
  });
  $('#osiPhase').textContent = step.phase;
  $('#osiStep').textContent = `${pad(index + 1)} / ${pad(osiSteps.length)}`;
  $('#osiDirectionIcon').textContent = step.icon;
  $('#osiHeadline').textContent = step.title;
  $('#osiDescription').textContent = step.desc;
  $('#osiPdu').innerHTML = step.chips.map(c => `<span class="${c.c}">${esc(c.t)}</span>`).join('');
  $('#osiProgressBar').style.width = `${(index + 1) / osiSteps.length * 100}%`;
  $('#wireLabel').textContent = step.kind === 'wire' ? 'Signal in flight' : 'Bits on the wire';
  if (!silent) logOsi(step.log);
}
function stopOsiTimers() {
  clearInterval(osiTimer);
  osiTimer = null;
}
function startOsi() {
  stopOsiTimers();
  buildOsiSteps();
  $('#osiFlow').textContent = osiFlipped ? 'Receiver to sender' : 'Sender to receiver';
  osiIndex = 0; osiPlaying = true;
  $('[data-osi="pause"]').disabled = false;
  $('#osiLog').innerHTML = '';
  logOsi(`new message · direction ${osiFlipped ? 'receiver → sender' : 'sender → receiver'}`);
  renderOsiStep(osiSteps[0], 0);
  $('[data-osi="pause"]').textContent = 'Pause';
  const speed = Number($('#osiSpeed').value);
  osiTimer = setInterval(() => {
    if (!osiPlaying) return;
    osiIndex++;
    if (osiIndex >= osiSteps.length) {
      stopOsiTimers();
      if ($('#osiRepeat').checked) {
        startOsi();
        return;
      }
      logOsi('Message delivered');
      osiPlaying = false;
      $('#osiPhase').textContent = 'Delivered';
      $('[data-osi="pause"]').disabled = true;
      return;
    }
    renderOsiStep(osiSteps[osiIndex], osiIndex);
  }, 850 * speed);
}
function osiControls(action) {
  if (action === 'send') startOsi();
  if (action === 'pause') {
    if (!osiPlaying && !osiTimer) { startOsi(); return; }
    osiPlaying = !osiPlaying;
    if (osiPlaying) {
      if (!osiTimer) { startOsi(); return; }
      $('[data-osi="pause"]').textContent = 'Pause';
      logOsi('▶ simulation resumed');
    } else {
      $('[data-osi="pause"]').textContent = 'Resume';
      $('#osiPhase').textContent = 'PAUSED';
      logOsi('❚❚ simulation paused');
    }
  }
  if (action === 'reverse') { osiFlipped = !osiFlipped; startOsi(); }
}

/* ------------------------------------------------------------
   4. THE JOURNEY — visual live request
   ------------------------------------------------------------ */
const NODES = {
  device:{ x:75, y:210, name:'Your laptop', sub:'192.168.1.24' },
  router:{ x:225, y:210, name:'Home router', sub:'DHCP · NAT · ARP' },
  dns:{ x:355, y:80, name:'DNS resolver', sub:'udp/53 · cache' },
  isp:{ x:410, y:210, name:'ISP edge', sub:'BGP next hop' },
  firewall:{ x:565, y:210, name:'Cloud firewall', sub:'policy: allow 443' },
  balancer:{ x:715, y:210, name:'Load balancer', sub:'TLS + pool' },
  proxy:{ x:865, y:210, name:'Reverse proxy', sub:'route by path' },
  server:{ x:1015, y:210, name:'App server', sub:'atlas.example' }
};
const EDGES = {
  'device-router':'M75 210 L225 210',
  'router-dns':'M225 210 Q265 80 355 80',
  'dns-router':'M355 80 Q290 80 225 210',
  'router-isp':'M225 210 L410 210',
  'isp-firewall':'M410 210 L565 210',
  'firewall-balancer':'M565 210 L715 210',
  'balancer-proxy':'M715 210 L865 210',
  'proxy-server':'M865 210 L1015 210',
  'server-device':'M1015 210 Q545 395 75 210'
};
const JOURNEY = [
  { node:'device', edge:'device-router', tag:'DHCP · IP', title:'A lease is already in hand',
    detail:'The laptop has 192.168.1.24/24, a default gateway and resolver addresses from DHCP.',
    packet:[['L3 src','192.168.1.24'],['App intent','GET /dashboard'],['State','ready']], ms:0 },
  { node:'router', edge:'device-router', tag:'SUBNET · ARP · MAC', title:'Is the destination nearby?',
    detail:'203.0.113.42 is outside /24, so ARP finds the gateway’s MAC and the frame goes there.',
    packet:[['L2 dst','3A:7F:0C:21:9B:4E'],['L3 dst','203.0.113.42'],['Next hop','192.168.1.1']], ms:3 },
  { node:'dns', edge:'router-dns', tag:'DNS · UDP · PORTS', title:'Name becomes a number',
    detail:'A UDP question on port 53 returns A 203.0.113.42 with a 300 second TTL.',
    packet:[['Query','atlas.example A'],['Transport','UDP :53'],['Answer','203.0.113.42']], ms:24 },
  { node:'router', edge:'dns-router', tag:'NAT · PORTS', title:'Private source gets a public mask',
    detail:'The router maps 192.168.1.24:51244 to 198.51.100.7:51244 and remembers the flow.',
    packet:[['Before','192.168.1.24:51244'],['After','198.51.100.7:51244'],['Table','stateful entry']], ms:26 },
  { node:'isp', edge:'router-isp', tag:'ROUTING · IP', title:'Each router picks the next turn',
    detail:'Longest-prefix matches carry the packet across access, metro and transit networks.',
    packet:[['TTL','64 → 60'],['Hops','gateway → ISP → transit'],['Route','default + BGP']], ms:38 },
  { node:'firewall', edge:'isp-firewall', tag:'FIREWALL · PORTS', title:'Policy verdict at the edge',
    detail:'Stateful rules permit tcp/443 and quietly drop an unsolicited tcp/22 probe.',
    packet:[['dst port','443'],['Rule','ALLOW established+443'],['Dropped','tcp/22']], ms:45 },
  { node:'balancer', edge:'firewall-balancer', tag:'TCP · HANDSHAKE · TLS', title:'Handshake, then a private tunnel',
    detail:'SYN → SYN-ACK → ACK, then TLS 1.3 verifies the certificate and derives session keys.',
    packet:[['Flags','SYN, SYN-ACK, ACK'],['Cipher','TLS_AES_128_GCM_SHA256'],['Cert','valid · atlas.example']], ms:86 },
  { node:'proxy', edge:'balancer-proxy', tag:'HTTPS · HTTP · LB', title:'One encrypted request, one healthy worker',
    detail:'The balancer selects app-b; the reverse proxy matches /dashboard and forwards the HTTP request.',
    packet:[['Request','GET /dashboard HTTP/2'],['Headers','host · accept · cookie'],['Backend','app-b:3000']], ms:121 },
  { node:'server', edge:'proxy-server', tag:'PROXY · HTTP', title:'Application builds the answer',
    detail:'A handler reads data, renders HTML and returns 200 with cache and content headers.',
    packet:[['Status','200 OK'],['Content','text/html · 48 KB'],['Cache','private, max-age=0']], ms:163 },
  { node:'device', edge:'server-device', tag:'OSI · TCP', title:'Wrappers come off, pixels appear',
    detail:'The response climbs the OSI layers on your laptop; TCP reassembles it and the browser paints.',
    packet:[['Decap','L1 → L7'],['Verified','TLS record MAC'],['Painted','DOM + assets']], ms:178 },
  { node:'server', edge:'proxy-server', tag:'WEBSOCKETS · HTTP', title:'The conversation stays open',
    detail:'A dashboard widget upgrades to wss:// so live numbers arrive without repeated requests.',
    packet:[['Upgrade','101 Switching Protocols'],['Channel','wss://live.atlas.example'],['Frames','push on change']], ms:180 }
];
const FAULTS = {
  dhcp:{ at:0, label:'NO INTERNET / NO LEASE', text:'Wi-Fi is associated, but no DHCP server answered. Without an IP, mask and gateway there is nothing to put on the wire.', fix:'Renew the lease, check the pool, then verify the router.' },
  arp:{ at:1, label:'GATEWAY UNREACHABLE', text:'The client cannot resolve the next-hop MAC. Local delivery stops before any public traffic exists.', fix:'Check cable/Wi-Fi, VLAN assignment and duplicate IPs.' },
  dns:{ at:2, label:'DNS PROBE FAILED / NXDOMAIN', text:'The name never became an address. The connection cannot even begin because the destination is unknown.', fix:'Test another resolver, check the record and the local DNS cache.' },
  firewall:{ at:5, label:'CONNECTION TIMED OUT', text:'Packets reach the edge and are silently dropped. Silence looks like a timeout, not a refusal.', fix:'Verify the security group allows tcp/443 from your source range.' },
  tls:{ at:6, label:'CERTIFICATE WARNING', text:'The TCP path is healthy but identity verification failed, so the browser refuses to continue.', fix:'Check certificate dates, hostname coverage and the client clock.' },
  server:{ at:8, label:'502 BAD GATEWAY', text:'The proxy is alive but every healthy upstream is gone. The failure is above the transport layer.', fix:'Inspect health checks, app logs and the origin pool.' },
  loss:{ at:4, label:'SEVERE PACKET LOSS', text:'Retransmissions consume the retry budget and the flow stalls in the transit network.', fix:'Test with ping/mtr, switch radios or paths, then check congestion.' }
};
let journey = { running:false, paused:false, index:0, timer:null, elapsed:0 };
function initJourney() {
  $('#mapLines').innerHTML = Object.entries(EDGES).map(([k, d]) => `<path data-edge="${k}" d="${d}"></path>`).join('');
  $('#mapNodes').innerHTML = Object.entries(NODES).map(([k, n]) => `
    <div class="map-node" data-node="${k}" style="left:${n.x / 11}%;top:${n.y / 4.2}%">
      <div class="node-icon"><svg class="icon" aria-hidden="true"><use href="#i-${k}"/></svg></div><div class="node-name">${n.name}</div><div class="node-sub">${n.sub}</div>
    </div>`).join('');
  $('#metricGrid').innerHTML = [['dns','DNS'],['tcp','TCP'],['tls','TLS'],['total','TOTAL']]
    .map(([k, label]) => `<div class="metric" data-metric="${k}"><span>${label}</span><strong>—</strong></div>`).join('');
  resetJourney();
}
function setMetric(key, value) {
  const m = $(`[data-metric="${key}"] strong`);
  if (m) m.textContent = value;
}
function moveTraveler(nodeKey, label) {
  const n = NODES[nodeKey], t = $('#traveler');
  t.style.left = `${n.x / 11}%`;
  t.style.top = `${n.y / 4.2}%`;
  t.classList.add('is-visible');
  $('#travelerLabel').textContent = label;
}
function resetJourney() {
  clearInterval(journey.timer);
  journey = { running:false, paused:false, index:0, timer:null, elapsed:0 };
  $$('.map-node').forEach(n => n.classList.remove('is-active', 'is-visited', 'is-failed'));
  $$('.map-lines path').forEach(p => p.classList.remove('is-hot', 'is-done'));
  $('#traveler').classList.remove('is-visible');
  $('#traceList').innerHTML = '<div class="trace-row"><span class="trace-dot"></span><span class="trace-time">00 ms</span><span>Capture idle — press “Run request” to begin.</span><span class="trace-tag">STANDBY</span></div>';
  $('#journeyStatus').textContent = 'STANDBY';
  $('#journeyRun').textContent = 'Run request';
  $('#packetDetail').innerHTML = 'No packet captured yet. Press run to start the capture.';
  ['dns','tcp','tls','total'].forEach(k => setMetric(k, '—'));
  $('#journeyCallout p').innerHTML = '<strong>Try breaking it.</strong> Choose a fault above, run the request, and watch where the chain stops. Every failure maps to a real symptom in the troubleshooting section.';
}
function setPacket(step) {
  $('#packetDetail').innerHTML = step.packet.map(([k, v], i) =>
    `<div class="packet-line"><span>${esc(k)}</span><b class="${i === 0 ? 'hl' : ''}">${esc(v)}</b></div>`).join('');
}
function startJourney() {
  resetJourney();
  journey.running = true;
  $('#journeyStatus').textContent = 'CAPTURING';
  $('#journeyRun').textContent = 'Pause';
  $('#traceList').innerHTML = '';
  const fault = $('#faultSelect').value;
  const fail = FAULTS[fault];
  journey.timer = setInterval(() => {
    if (journey.paused) return;
    const i = journey.index;
    if (i >= JOURNEY.length) { finishJourney(); return; }
    const step = JOURNEY[i];
    if (fail && i === fail.at) { journeyFail(step, fail, i); return; }
    $$('.map-node').forEach(n => n.classList.remove('is-active'));
    $$('.map-lines path').forEach(p => p.classList.remove('is-hot'));
    const active = $(`[data-node="${step.node}"]`);
    active.classList.add('is-active', 'is-visited');
    const edge = $(`[data-edge="${step.edge}"]`);
    if (edge) edge.classList.add('is-hot', 'is-done');
    $$('.trace-row').forEach(r => r.classList.remove('is-current'));
    moveTraveler(step.node, step.tag.split(' · ')[0]);
    $('#traceList').insertAdjacentHTML('beforeend', `
      <div class="trace-row is-current"><span class="trace-dot"></span><span class="trace-time">${pad(step.ms, 3)} ms</span>
      <span><b>${esc(step.title)}</b> — ${esc(step.detail)}</span><span class="trace-tag">${esc(step.tag)}</span></div>`);
    $('#traceList').scrollTop = $('#traceList').scrollHeight;
    setPacket(step);
    if (i >= 2) setMetric('dns', '24 ms');
    if (i >= 6) { setMetric('tcp', '41 ms'); setMetric('tls', '36 ms'); }
    if (i >= 8) setMetric('total', `${step.ms} ms`);
    $('#journeyStatus').textContent = `STOP ${pad(i + 1)} / ${pad(JOURNEY.length)}`;
    journey.index++;
  }, 780);
}
function finishJourney() {
  clearInterval(journey.timer);
  journey.running = false;
  $('#journeyRun').textContent = 'Run again';
  $('#journeyStatus').textContent = 'COMPLETE · 200 OK';
  $('#travelerLabel').textContent = 'STREAM OPEN';
  $('#journeyCallout p').innerHTML = '<strong>Clean run.</strong> Eleven stops, all twenty concepts involved, 178 ms from click to paint. Now inject a fault and see the exact layer that gives up.';
}
function journeyFail(step, fail, i) {
  clearInterval(journey.timer);
  journey.running = false;
  $('#journeyRun').textContent = 'Run again';
  $('#journeyStatus').textContent = 'FAILED · CHAIN STOPPED';
  $$('.map-node').forEach(n => n.classList.remove('is-active'));
  $(`[data-node="${step.node}"]`).classList.add('is-failed');
  $$('.trace-row').forEach(r => r.classList.remove('is-current'));
  $('#traceList').insertAdjacentHTML('beforeend', `
    <div class="trace-row is-failed"><span class="trace-dot"></span><span class="trace-time">${pad(i + 1, 3)} ·</span>
    <span><b>${esc(fail.label)}</b> — ${esc(fail.text)}</span><span class="trace-tag">BREAK</span></div>`);
  $('#traceList').scrollTop = $('#traceList').scrollHeight;
  $('#packetDetail').innerHTML = `<div class="packet-line"><span>Stopped at</span><b class="hl">${esc(step.title)}</b></div>
    <div class="packet-line"><span>Symptom</span><b class="bad">${esc(fail.label)}</b></div>
    <div class="packet-line"><span>Likely layer</span><b>L${7 - Math.min(6, Math.floor(i / 2))}</b></div>`;
  $('#travelerLabel').textContent = 'DROPPED';
  $('#journeyCallout p').innerHTML = `<strong>${esc(fail.label)}</strong> ${esc(fail.text)} <em>First move:</em> ${esc(fail.fix)}`;
}
function journeyRunClick() {
  if (journey.running) {
    journey.paused = !journey.paused;
    $('#journeyRun').textContent = journey.paused ? 'Resume' : 'Pause';
    $('#journeyStatus').textContent = journey.paused ? 'PAUSED' : 'CAPTURING';
  } else startJourney();
}

/* ------------------------------------------------------------
   5. TROUBLESHOOTING
   ------------------------------------------------------------ */
const SCENARIOS = [
  {id:'nointernet', badge:'Connected, No Internet', layer:'3', component:'ISP WAN Uplink', title:'Wi-Fi Connected, No Internet',
   summary:'Wi-Fi signal bars are full and local network printers/NAS respond, yet every external website and app fails offline.',
   cause:'Your laptop leased 192.168.1.42 from your home router. The LAN works, but the ISP modem lost sync and the router has no upstream connection.',
   remedy:'Inspect the modem’s WAN or optical status light. Check the ISP outage status and restore the uplink before re-testing.'},
  {id:'nxdomain', badge:'DNS Error', layer:'7', component:'DNS Record', title:'DNS_PROBE_FINISHED_NXDOMAIN',
   summary:'The browser cannot find the staging hostname. Other websites load normally.',
   cause:'The staging hostname has no address record in the DNS zone used by the team.',
   remedy:'Verify the hostname and restore the missing DNS record in the correct zone.'},
  {id:'apipa', badge:'No DHCP Lease', layer:'3', component:'DHCP Addressing', title:'Connected, No IP (169.254.x.x)',
   summary:'The device joins Wi-Fi but assigns itself a link-local address. It cannot reach the gateway.',
   cause:'The network has handed out every address in its DHCP pool, so no server offer returns. The client falls back to a link-local address.',
   remedy:'Make an address available in the DHCP pool, then renew the client lease.'},
  {id:'timeout', badge:'Timed Out', layer:'4', component:'Firewall Policy', title:'Connection Timed Out',
   summary:'The hostname resolves, but the browser waits until the connection times out.',
   cause:'The server firewall silently drops TCP connections to port 443 from this client network.',
   remedy:'Correct the HTTPS rule to allow the intended client network to reach TCP port 443.'},
  {id:'refused', badge:'Connection Refused', layer:'4', component:'TCP Listener', title:'Connection Refused',
   summary:'The server responds immediately, but the browser cannot connect to the service.',
   cause:'The application listens only on the loopback interface. Connections arriving on the service interface receive a TCP reset.',
   remedy:'Bind the service to its intended network interface and verify the listener on port 443.'},
  {id:'ssl', badge:'Certificate Error', layer:'6', component:'TLS Certificate', title:'Privacy Error / Bad Certificate',
   summary:'The browser reaches the server and shows a certificate expiry warning.',
   cause:'Certificate renewal succeeded, but the reverse proxy still serves the expired certificate.',
   remedy:'Load the renewed certificate and its chain into the proxy, then verify the certificate dates.'},
  {id:'gateway', badge:'Bad Gateway', layer:'7', component:'Upstream Service', title:'502 / 503 Bad Gateway',
   summary:'The proxy responds to the browser, but it cannot retrieve the page from its application servers.',
   cause:'A recent deployment broke the application health check on every upstream worker.',
   remedy:'Restore a healthy application build and verify that the proxy can reach a ready worker.'},
  {id:'loss', badge:'Degraded Link', layer:'1', component:'Wi-Fi Radio', title:'High Latency & Packet Loss',
   summary:'Voice calls cut out and downloads stall intermittently, even near the router.',
   cause:'Nearby networks crowd the Wi-Fi channel. Frames need repeated transmissions before they reach the access point.',
   remedy:'Move to a clearer Wi-Fi channel and compare the gateway ping results after the change.'}
];

/* Five exact steps per scenario. Every step keeps both command sets. */
const SCENARIO_STEPS = {
  nointernet: [
    { title:'Confirm the lease and gateway',
      detail:'You want a private IPv4 address and a default gateway. A 169.254.x.x result means the lease failed — use the no-DHCP checklist instead.',
      unix:`# macOS
ipconfig getifaddr en0; ipconfig getoption en0 router
# Linux
ip -4 addr show; ip route show`,
      win:`ipconfig /all` },
    { title:'Test the gateway',
      detail:'A reply proves the radio and local segment are healthy. Loss here is a local link or addressing problem, not the ISP.',
      unix:`ping -c 4 192.168.1.1`,
      win:`ping -n 4 192.168.1.1` },
    { title:'Bypass DNS with a public IP',
      detail:'If a public IP replies, the local network is fine and the uplink is reaching the internet.',
      unix:`ping -c 4 1.1.1.1`,
      win:`ping -n 4 1.1.1.1` },
    { title:'Check name resolution',
      detail:'A clean answer narrows the failure to routing or the WAN. A hang points at DNS instead.',
      unix:`nslookup example.com 1.1.1.1`,
      win:`nslookup example.com 1.1.1.1` },
    { title:'Inspect the uplink, then retest HTTPS',
      detail:'Open the router status page and read the WAN or modem state. If the line is down, restore it or wait out the ISP outage before running the second command.',
      unix:`curl -s --max-time 5 http://192.168.1.1 | head -n 20
curl -sI --max-time 8 https://example.com | head -n 1`,
      win:`curl.exe -s --max-time 5 http://192.168.1.1
curl.exe -sI --max-time 8 https://example.com` }
  ],
  nxdomain: [
    { title:'Query two independent resolvers',
      detail:'NXDOMAIN from both public resolvers confirms the record is missing, not that one resolver cache is stale.',
      unix:`dig +short staging.atlas.example @1.1.1.1
dig +short staging.atlas.example @8.8.8.8`,
      win:`nslookup -type=A staging.atlas.example 1.1.1.1
nslookup -type=A staging.atlas.example 8.8.8.8` },
    { title:'Identify the resolver in use',
      detail:'Confirm which DNS servers the current network handed your device before trusting a local answer.',
      unix:`# macOS
scutil --dns | grep nameserver | head -4
# Linux
resolvectl status | grep "Current DNS"`,
      win:`ipconfig /all | findstr /i "DNS Servers"` },
    { title:'Rule out a hosts-file override',
      detail:'A local hosts entry wins before DNS is queried and can make a correct public record look broken.',
      unix:`grep -n atlas.example /etc/hosts`,
      win:`findstr /i atlas.example C:\\Windows\\System32\\drivers\\etc\\hosts` },
    { title:'Restore the record, then flush the cache',
      detail:'Add staging.atlas.example as an A record for 203.0.113.42 in its zone. Flush locally after the old TTL has passed.',
      unix:`# macOS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
# Linux
sudo resolvectl flush-caches`,
      win:`ipconfig /flushdns` },
    { title:'Verify the public answer',
      detail:'The public resolver should now return the record. If it does not, check the zone name and delegation.',
      unix:`dig +short staging.atlas.example @1.1.1.1`,
      win:`nslookup -type=A staging.atlas.example 1.1.1.1` }
  ],
  apipa: [
    { title:'Confirm the self-assigned address',
      detail:'A 169.254.x.x address with no default gateway means the client could not obtain a DHCP lease.',
      unix:`# macOS
ifconfig en0 | grep "inet "
# Linux
ip -4 addr show`,
      win:`ipconfig /all` },
    { title:'Confirm the Wi-Fi association',
      detail:'The radio must be associated with the expected SSID before a DHCP exchange can happen.',
      unix:`# macOS
networksetup -getairportnetwork en0
# Linux
nmcli -f GENERAL.STATE,GENERAL.CONNECTION dev show wlan0`,
      win:`netsh wlan show interfaces` },
    { title:'Release and request a new lease',
      detail:'This discards the failed configuration and sends a fresh DHCP discover. A new offer is the expected result.',
      unix:`# macOS
sudo ipconfig set en0 NONE; sudo ipconfig set en0 DHCP
# Linux
sudo dhclient -r; sudo dhclient`,
      win:`ipconfig /release
ipconfig /renew` },
    { title:'Verify the new configuration',
      detail:'Expect a private address, a default gateway and DNS servers. Still link-local means no server answered.',
      unix:`# macOS
ipconfig getifaddr en0; ipconfig getoption en0 router
# Linux
ip -4 addr show; ip route show`,
      win:`ipconfig /all` },
    { title:'Prove the route beyond the gateway',
      detail:'If no offer returns, free addresses in the pool or enlarge it, then repeat the renewal step.',
      unix:`ping -c 4 192.168.1.1 && ping -c 4 1.1.1.1`,
      win:`ping -n 4 192.168.1.1
ping -n 4 1.1.1.1` }
  ],
  timeout: [
    { title:'Time the failed connection',
      detail:'A timeout — not a reset — is the signature of a silent drop. Note whether it stalls at TCP or TLS.',
      unix:`curl -v --connect-timeout 6 https://atlas.example`,
      win:`curl.exe -v --connect-timeout 6 https://atlas.example` },
    { title:'Compare another port on the host',
      detail:'A reset means the host is reachable with no listener. Another hang means the host or a path is dropping traffic.',
      unix:`curl -v --connect-timeout 6 http://atlas.example`,
      win:`curl.exe -v --connect-timeout 6 http://atlas.example` },
    { title:'Trace where replies stop',
      detail:'The last hop that answers before the silence is the network to inspect.',
      unix:`# macOS
traceroute -w 1 -q 2 atlas.example
# Linux
tracepath atlas.example`,
      win:`tracert -w 1000 -h 12 atlas.example` },
    { title:'Rule out your local firewall',
      detail:'If another HTTPS site loads, outbound TCP 443 from this client is allowed and the drop is at the destination edge.',
      unix:`curl -sI --max-time 6 https://example.com | head -n 1`,
      win:`curl.exe -sI --max-time 6 https://example.com` },
    { title:'Allow TCP 443, then retest',
      detail:'At the edge firewall, add an inbound rule permitting this client network to the server on TCP 443. A 200 confirms the policy change.',
      unix:`curl -sI --max-time 8 https://atlas.example | head -n 1`,
      win:`curl.exe -sI --max-time 8 https://atlas.example` }
  ],
  refused: [
    { title:'Read the immediate failure',
      detail:'Connection refused arrives in milliseconds. That is a reachable host actively rejecting TCP, not a timeout.',
      unix:`curl -v --connect-timeout 6 https://atlas.example`,
      win:`curl.exe -v --connect-timeout 6 https://atlas.example` },
    { title:'Confirm the listening address',
      detail:'A listener on 127.0.0.1 is not available on the service interface. Check the bind column, not only the port.',
      unix:`# macOS
sudo lsof -nP -iTCP:443 -sTCP:LISTEN
# Linux
sudo ss -tlnp '( sport = :443 )'`,
      win:`netstat -ano -p tcp | findstr :443` },
    { title:'Test from inside the host',
      detail:'A 200 from 127.0.0.1 while remote clients are refused confirms the service is bound to loopback only.',
      unix:`curl -sk https://127.0.0.1 -o /dev/null -w '%{http_code}\\n'`,
      win:`curl.exe -sk https://127.0.0.1 -o NUL -w "%{http_code}\\n"` },
    { title:'Check for a proxy override',
      detail:'A stale HTTP proxy variable can send HTTPS requests to a closed local port instead of the real destination.',
      unix:`env | grep -i proxy`,
      win:`set | findstr /i proxy` },
    { title:'Bind the service interface, then retest',
      detail:'Change the listen address from 127.0.0.1 to 0.0.0.0 or the service IP, restart the app, and confirm a 200 from the client.',
      unix:`curl -sI https://atlas.example | head -n 1`,
      win:`curl.exe -sI https://atlas.example` }
  ],
  ssl: [
    { title:'Read the served certificate dates',
      detail:'Compare notAfter with today. An expired date proves the certificate currently on the wire is the wrong one.',
      unix:`openssl s_client -connect atlas.example:443 -servername atlas.example </dev/null 2>/dev/null | openssl x509 -noout -dates -subject -issuer`,
      win:`curl.exe -vI https://atlas.example 2>&1 | findstr /i "subject issuer expire"` },
    { title:'Check your clock against UTC',
      detail:'A device clock outside the certificate validity window produces a warning even when the server certificate is valid.',
      unix:`date -u`,
      win:`w32tm /query /status` },
    { title:'Inspect the chain the server sends',
      detail:'The leaf certificate must be followed by its intermediate chain. A missing chain is a different error from expiry.',
      unix:`openssl s_client -connect atlas.example:443 -servername atlas.example -showcerts </dev/null 2>/dev/null | grep -E "s:|i:"`,
      win:`curl.exe -vI https://atlas.example 2>&1 | findstr /i "SSL certificate"` },
    { title:'Load the renewed certificate and reload',
      detail:'Install the renewed leaf plus intermediate chain, point the TLS terminator at those files, and reload it. Substitute your proxy’s reload command if it is not nginx.',
      unix:`sudo nginx -t
sudo systemctl reload nginx`,
      win:`nginx -t
Restart-Service nginx` },
    { title:'Verify the new expiry',
      detail:'The proxy must now present a future notAfter date and complete an HTTPS request without a warning.',
      unix:`openssl s_client -connect atlas.example:443 -servername atlas.example </dev/null 2>/dev/null | openssl x509 -noout -enddate`,
      win:`curl.exe -vI https://atlas.example 2>&1 | findstr /i "expire date"` }
  ],
  gateway: [
    { title:'Capture the proxy response',
      detail:'A 502 or 503 from the proxy means TLS completed but the upstream application did not return a usable response.',
      unix:`curl -sS -D - https://atlas.example -o /dev/null`,
      win:`curl.exe -sS -D - https://atlas.example -o NUL` },
    { title:'Measure the proxy response time',
      detail:'A fast error is an application failure. A slow error can be a timeout or a saturated upstream pool.',
      unix:`curl -s -o /dev/null -w '%{http_code} %{time_total}s\\n' https://atlas.example`,
      win:`curl.exe -s -o NUL -w "%{http_code} %{time_total}s\\n" https://atlas.example` },
    { title:'Ask the origin health endpoint',
      detail:'The proxy should only send traffic to workers that pass /healthz. A failing health response points above the network layer.',
      unix:`curl -sS https://atlas.example/healthz`,
      win:`curl.exe -sS https://atlas.example/healthz` },
    { title:'Read the first origin error',
      detail:'Find the first failure around the deploy time. A repeated startup error means the build never became healthy.',
      unix:`# systemd unit example
journalctl -u atlas-api -n 50 --no-pager`,
      win:`wevtutil qe Application /c:20 /rd:true /f:text | findstr /i atlas` },
    { title:'Restart or roll back, then verify',
      detail:'Restore the last healthy build if the new one keeps failing, then confirm health through the proxy.',
      unix:`sudo systemctl restart atlas-api
curl -sI https://atlas.example/healthz | head -n 1`,
      win:`net stop atlas-api
net start atlas-api
curl.exe -sI https://atlas.example/healthz` }
  ],
  loss: [
    { title:'Measure loss to the gateway',
      detail:'Any loss on this first hop is a local Wi-Fi or radio problem. Record the percentage and latency range.',
      unix:`ping -c 20 192.168.1.1 | tail -n 3`,
      win:`ping -n 20 192.168.1.1` },
    { title:'Measure loss past the router',
      detail:'Compare the two summaries. Loss only past the gateway points upstream instead of at the access point.',
      unix:`ping -c 20 1.1.1.1 | tail -n 3`,
      win:`ping -n 20 1.1.1.1` },
    { title:'Read the Wi-Fi link quality',
      detail:'Very low RSSI or a poor signal-to-noise ratio explains retransmissions before any web tool sees them.',
      unix:`# macOS
system_profiler SPAirPortDataType | grep -E "Channel|Signal|Noise"
# Linux
nmcli -f IN-USE,SSID,CHAN,SIGNAL dev wifi`,
      win:`netsh wlan show interfaces` },
    { title:'List neighbours sharing the channel',
      detail:'Choose a channel with fewer strong neighbours, or move to 5 GHz where congestion is lower.',
      unix:`# macOS
sudo wdutil info | grep -iE "channel|rssi|noise"
# Linux
nmcli -f SSID,CHAN,SIGNAL dev wifi list`,
      win:`netsh wlan show networks mode=bssid | findstr /i "SSID Channel Signal"` },
    { title:'Retest after the channel change',
      detail:'Healthy Wi-Fi should sit below 1% loss with a stable latency range. If it does not, test a wired link.',
      unix:`ping -c 50 1.1.1.1 | tail -n 3`,
      win:`ping -n 50 1.1.1.1` }
  ]
};

const PLATFORM_NAMES = { unix:'macOS / Linux', windows:'Windows CMD / PowerShell' };
let activePlatform = 'unix';
let activeFault = null;
let checkedSteps = new Set();

function platformKey() {
  return activePlatform === 'windows' ? 'win' : 'unix';
}
function renderTrouble() {
  $('#troubleGrid').innerHTML = SCENARIOS.map(s => `
    <button type="button" class="trouble-card" data-scenario="${s.id}" aria-haspopup="dialog" aria-controls="faultDialog">
      <span class="fault-badges"><strong>${esc(s.badge)}</strong><span class="fault-layer">Layer ${s.layer}</span></span>
      <strong class="fault-title">${esc(s.title)}</strong><span>${esc(s.summary)}</span>
      <span class="fault-cause">Example cause · ${esc(s.cause)}</span>
      <span class="fault-foot"><span>Layer ${s.layer} · ${esc(s.component)}</span><span>Open checklist →</span></span>
    </button>`).join('');

  $('#faultSteps').addEventListener('change', event => {
    const check = event.target.closest('.fault-check');
    if (!check) return;
    const step = check.closest('.fault-step');
    step.classList.toggle('is-done', check.checked);
    const index = Number(step.dataset.step);
    if (check.checked) checkedSteps.add(index);
    else checkedSteps.delete(index);
    updateChecklistProgress();
  });
  $('#resetChecklist').addEventListener('click', resetChecklist);
  $('#faultDialog').addEventListener('click', event => {
    if (event.target !== event.currentTarget) return;
    const r = event.currentTarget.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.currentTarget.close();
  });
}
function initPlatform() {
  $$('.platform-option').forEach(button => {
    button.addEventListener('click', () => setPlatform(button.dataset.platform));
  });
  setPlatform(activePlatform, false);
}
function setPlatform(platform, announce = true) {
  if (!PLATFORM_NAMES[platform]) return;
  activePlatform = platform;
  $$('.platform-option').forEach(button => {
    const selected = button.dataset.platform === platform;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('#dialogPlatform').textContent = PLATFORM_NAMES[platform];
  if (activeFault) renderChecklist();
  if (announce) toast(`Checklist commands: ${PLATFORM_NAMES[platform]}`);
}
function renderChecklist() {
  if (!activeFault) return;
  const steps = SCENARIO_STEPS[activeFault.id] || [];
  const key = platformKey();
  $('#faultSteps').innerHTML = steps.map((step, i) => `
    <li class="fault-step ${checkedSteps.has(i) ? 'is-done' : ''}" data-step="${i}">
      <input class="fault-check" type="checkbox" id="faultStep-${i}" ${checkedSteps.has(i) ? 'checked' : ''}>
      <label class="step-mark" for="faultStep-${i}" aria-hidden="true"><span>${pad(i + 1)}</span></label>
      <div class="step-main">
        <label class="step-title" for="faultStep-${i}">${esc(step.title)}</label>
        <p class="step-detail">${esc(step.detail)}</p>
        <div class="command-line"><code>${esc(step[key])}</code><button class="copy-cmd" type="button" data-copy="${esc(step[key])}" aria-label="Copy command for step ${i + 1}">Copy</button></div>
      </div>
    </li>`).join('');
  updateChecklistProgress();
}
function resetChecklist() {
  checkedSteps.clear();
  $$('#faultSteps .fault-step').forEach(step => step.classList.remove('is-done'));
  renderChecklist();
}
function updateChecklistProgress() {
  const checks = $$('#faultSteps .fault-check');
  const total = checks.length;
  const done = checks.filter(check => check.checked).length;
  $('#faultProgressText').textContent = `${done}/${total}`;
  $('#faultProgressBar').style.width = total ? `${done / total * 100}%` : '0%';
  $('#faultProgress').setAttribute('aria-valuemax', String(total));
  $('#faultProgress').setAttribute('aria-valuenow', String(done));
  const complete = total > 0 && done === total;
  $('#faultDialog').classList.toggle('is-complete', complete);
  $('#faultFoot').textContent = complete ? 'All steps complete. Confirm the service before closing.' : 'Tick each step off as you verify it.';
}
function runDiagnostic(id) {
  activeFault = SCENARIOS.find(s => s.id === id);
  if (!activeFault) return;
  checkedSteps = new Set();
  $('#faultBadge').textContent = activeFault.badge;
  $('#faultLayer').textContent = `Layer ${activeFault.layer} · ${activeFault.component}`;
  $('#faultTitle').textContent = activeFault.title;
  $('#faultSummary').textContent = activeFault.summary;
  $('#dialogPlatform').textContent = PLATFORM_NAMES[activePlatform];
  renderChecklist();
  $('#faultDialog').showModal();
  $('#faultDialog').scrollTop = 0;
}

/* ------------------------------------------------------------
   6. FINAL LAB — all 20 concepts in one live run
   ------------------------------------------------------------ */
const LAB_STAGES = [
  ['IP address','assign 192.168.1.24','L3 src = 192.168.1.24'],
  ['DNS','resolve atlas.example','DNS A → 203.0.113.42'],
  ['Ports','choose :443 + ephemeral','TCP dst = 443'],
  ['MAC address','find next-hop hardware','ETH dst = gateway'],
  ['ARP','cache gateway mapping','ARP 192.168.1.1 → MAC'],
  ['Routing','select egress path','IP ttl = 64 · next hop'],
  ['NAT','rewrite private source','SNAT → 198.51.100.7'],
  ['Subnetting','confirm remote target','/24 → use default gw'],
  ['DHCP','validate active lease','lease 24h · DNS 1.1.1.1'],
  ['TCP','number every byte','SEQ = 1000 · WIN = 64240'],
  ['Handshake','agree on state','SYN → SYN-ACK → ACK'],
  ['HTTPS / TLS','prove identity + encrypt','TLS 1.3 · cert valid'],
  ['HTTP','send the real request','GET /dashboard HTTP/2'],
  ['Load balancer','pick a healthy worker','pool → app-b'],
  ['Reverse proxy','match path to service','route → renderer'],
  ['Firewall','apply inbound policy','ALLOW tcp/443'],
  ['WebSockets','upgrade when needed','Upgrade: websocket'],
  ['UDP','alternative datagram path','QUIC / DNS :53'],
  ['OSI model','inspect every wrapper','L1…L7 verified'],
  ['Full recap','render + measure','200 OK · 178 ms']
];
let labSwitches = { tls:true, firewall:true, lb:true, nat:true };
let labToken = 0, labTimers = [];
function initLab() {
  $('#labStages').innerHTML = LAB_STAGES.map((s, i) => `
    <div class="lab-stage" data-stage="${i}"><div class="stage-num">${pad(i + 1)} / 20</div>
      <div class="stage-name">${esc(s[0])}</div><div class="stage-status">Ready</div></div>`).join('');
  updateLossLabel();
}
function updateLossLabel() { $('#lossValue').textContent = `${$('#labLoss').value}%`; }
function frameRows(step, cfg) {
  const rows = [
    { l:'L2 ETHERNET', v:'3A:7F:0C:21:9B:4E → 0A:1B:2C:3D:4E:5F' },
    { l:'L3 IP', v:`${cfg.nat ? '198.51.100.7' : '192.168.1.24'} → 203.0.113.42` },
    { l:'L4 TRANSPORT', v:cfg.transport === 'udp' ? 'UDP :443 · QUIC' : 'TCP :51244 → :443 · seq=1000' }
  ];
  if (step >= 11 && cfg.tls) rows.push({ l:'L6 TLS', v:'TLS 1.3 · AES-128-GCM · encrypted', secure:true });
  if (step >= 12) rows.push({ l:'L7 HTTP', v:`${cfg.transport === 'udp' ? 'HTTP/3' : 'HTTP/2'} GET ${cfg.path}` });
  if (step >= 16 && cfg.transport === 'ws') rows.push({ l:'L7 UPGRADE', v:'101 Switching Protocols · wss', secure:true });
  if (step >= 17 && cfg.transport !== 'udp') rows.push({ l:'ALT PATH', v:'DNS :53 uses UDP datagrams' });
  return rows.slice(-7);
}
function labLogLine(msg) {
  const log = $('#labLog');
  log.insertAdjacentHTML('beforeend', `<div class="log-line"><b>${clockStamp()}</b> ${esc(msg)}</div>`);
  log.scrollTop = log.scrollHeight;
}
function startLab() {
  labToken++;
  const token = labToken;
  labTimers.forEach(clearTimeout); labTimers = [];
  const cfg = {
    site:$('#labSite').value,
    transport:$('#labTransport').value,
    loss:Number($('#labLoss').value),
    tls:labSwitches.tls, firewall:labSwitches.firewall, lb:labSwitches.lb, nat:labSwitches.nat,
    path:$('#labSite').value.startsWith('api') ? '/v1/orders' : $('#labSite').value.startsWith('live') ? '/stream' : '/dashboard'
  };
  $$('.lab-stage').forEach(stage => {
    stage.className = 'lab-stage';
    $('.stage-status', stage).textContent = 'Ready';
  });
  $('#frameStack').innerHTML = '';
  $('#labLog').innerHTML = '';
  $('#labResult').innerHTML = '<strong class="result-placeholder">Running…</strong><p>Concepts are activating in guide order.</p>';
  labLogLine(`launch ${cfg.site} · transport=${cfg.transport} · loss=${cfg.loss}%`);
  let failure = null;
  const notes = [];
  if (!cfg.nat) failure = { step:6, title:'No return path', reason:'Private 192.168.1.24 is not routable on the public internet. NAT was disabled, so replies have nowhere to land.' };
  else if (cfg.loss > 25 && cfg.transport !== 'udp') failure = { step:9, title:'Retransmission budget exhausted', reason:`${cfg.loss}% loss at the TCP rung. Reliable delivery keeps retrying until the connection gives up. QUIC/UDP would degrade instead.` };
  if (!cfg.tls) notes.push('TLS off: the request travels as readable plaintext.');
  if (!cfg.firewall) notes.push('Firewall off: every port is exposed at the edge.');
  if (!cfg.lb) notes.push('Balancer off: single origin, no failover.');
  if (cfg.transport === 'udp' && cfg.loss > 0) notes.push(`UDP absorbed ${cfg.loss}% loss without retransmits — quality drops, connection survives.`);
  LAB_STAGES.forEach((stage, i) => {
    labTimers.push(setTimeout(() => {
      if (token !== labToken) return;
      $$('.lab-stage').forEach((s, j) => {
        s.classList.toggle('is-current', j === i);
        s.classList.toggle('is-done', j < i);
      });
      const box = $(`[data-stage="${i}"] .stage-status`);
      if (failure && i === failure.step) {
        $(`[data-stage="${i}"]`).classList.add('is-failed');
        box.textContent = 'Failed';
        labLogLine(`✕ stage ${pad(i + 1)} ${stage[0]} — ${failure.title}`);
        $('#labResult').innerHTML = `<strong class="failure">✕ ${esc(failure.title)}</strong><p>${esc(failure.reason)}

Turn NAT back on (or reduce loss / use UDP) and launch again.</p>`;
        $$('.lab-stage').forEach(s => s.classList.remove('is-current'));
        labToken++;
        return;
      }
      box.textContent = 'Done';
      $('#frameStack').innerHTML = frameRows(i, cfg).map(r =>
        `<div class="frame-row ${r.secure ? 'secure' : ''}"><b>${esc(r.l)}</b><span>${esc(r.v)}</span></div>`).join('');
      labLogLine(`✓ stage ${pad(i + 1)} ${stage[0]} — ${stage[2]}`);
      if (i === 6 && !cfg.nat) labLogLine('! private source still in the frame');
      if (i === 11 && !cfg.tls) labLogLine('! skipping encryption (plaintext)');
      if (i === 14 && !cfg.lb) labLogLine('! no pool: routing to the only origin');
      if (i === 15 && !cfg.firewall) labLogLine('! inbound policy bypassed');
      if (i === LAB_STAGES.length - 1) {
        $$('.lab-stage').forEach(s => { s.classList.remove('is-current'); s.classList.add('is-done'); });
        const code = cfg.site.startsWith('api') ? '200 OK · JSON 1.8 KB' : cfg.transport === 'ws' ? '101 Switching Protocols · stream live' : '200 OK · HTML 48 KB';
        $('#labResult').innerHTML = `<strong class="success">✓ ${esc(code)}</strong>
          <p><b>${cfg.site}</b> loaded in <b>178 ms</b> over ${cfg.transport === 'udp' ? 'HTTP/3 on QUIC/UDP' : cfg.transport === 'ws' ? 'TCP with a WebSocket upgrade' : 'TCP'} — all 20 concepts fired.${notes.length ? `

<span style="color:var(--amber)">Notes: ${esc(notes.join(' '))}</span>` : ''}</p>`;
        labLogLine('✓ complete · 20/20 concepts · 7 OSI wrappers verified');
      }
    }, 300 * (i + 1)));
  });
}

/* ------------------------------------------------------------
   7. GLOBAL UI + EVENT WIRING
   ------------------------------------------------------------ */
function initTheme() {
  const key = 'networking.theme';
  const root = document.documentElement;
  function apply(theme) {
    const light = theme === 'light';
    root.dataset.theme = light ? 'light' : 'dark';
    $('#themeLabel').textContent = light ? 'Dark mode' : 'Light mode';
    $('meta[name="theme-color"]').content = light ? '#faf9f6' : '#181a19';
  }
  let initial = 'dark';
  try { initial = localStorage.getItem(key) || initial; } catch { /* Storage may be unavailable for local files. */ }
  apply(initial);
  $('#themeToggle').addEventListener('click', () => {
    apply(root.dataset.theme === 'light' ? 'dark' : 'light');
    try { localStorage.setItem(key, root.dataset.theme); } catch { /* Keep the selection for this visit. */ }
  });
}
function initPlate() {
  const layers = [
    ['HTTP', 'The request carries a method, path and headers.'],
    ['TCP', 'Ports identify the endpoints. Sequence numbers order the bytes.'],
    ['IPv4', 'Source and destination IP addresses let routers forward the packet.'],
    ['Ethernet', 'MAC addresses deliver the frame across one local link.']
  ];
  let selected = 0;
  function step(delta) {
    selected = (selected + delta + layers.length) % layers.length;
    $$('.sheet').forEach(sheet => sheet.classList.toggle('selected', Number(sheet.dataset.sheet) === selected));
    $$('.call-line').forEach(label => label.classList.toggle('selected', Number(label.dataset.label) === selected));
    $('#plateNote strong').textContent = layers[selected][0];
    $('#plateNote span').textContent = layers[selected][1];
    $('#sheetNumber').textContent = `${selected + 1}/${layers.length}`;
  }
  $('#previousSheet').addEventListener('click', () => step(-1));
  $('#nextSheet').addEventListener('click', () => step(1));
}
function initChrome() {
  initTheme();
  initPlate();
  const nav = $('#primaryNav');
  const toggle = $('#navToggle');
  const links = $$('.primary-nav a');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#siteHeader')) setMenu(false);
  });
  links.forEach(link => link.addEventListener('click', () => setMenu(false)));
  const sections = links.map(link => document.getElementById(link.dataset.nav));
  let scheduled = false;
  function markSection() {
    const marker = $('#siteHeader').getBoundingClientRect().bottom + innerHeight * .22;
    const current = sections.filter(section => section.getBoundingClientRect().top <= marker).pop();
    links.forEach(link => {
      if (link.dataset.nav === current?.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scheduled = false;
  }
  function scheduleMark() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(markSection);
    }
  }
  addEventListener('scroll', scheduleMark, { passive:true });
  addEventListener('resize', scheduleMark);
  markSection();
  $('#heroTrace').addEventListener('click', startJourney);
}
document.addEventListener('click', async e => {
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    try { await navigator.clipboard.writeText(copy.dataset.copy); toast('Command copied to clipboard'); }
    catch { toast('Command: ' + copy.dataset.copy); }
    return;
  }
  const act = e.target.closest('[data-action]');
  if (act) {
    const card = act.closest('.concept-card');
    if (act.dataset.action === 'mini') { runMini(act.dataset.demo, card); return; }
    if (act.dataset.action === 'goLab') { $('#lab').scrollIntoView({ behavior:'smooth' }); startLab(); return; }
    if (act.dataset.action === 'port') {
      const p = act.dataset.port;
      portState[p] = portState[p] === 'open' ? 'closed' : 'open';
      renderPorts($('.mini-out', card));
      $(`[data-action="port"][data-port="${p}"]`, card).focus({ preventScroll:true });
      return;
    }
    if (act.dataset.action === 'rule') {
      const p = act.dataset.port;
      ruleState[p] = ruleState[p] === 'allow' ? 'deny' : 'allow';
      renderRules($('.mini-out', card));
      $(`[data-action="rule"][data-port="${p}"]`, card).focus({ preventScroll:true });
      return;
    }
  }
  const osiBtn = e.target.closest('[data-osi]');
  if (osiBtn) { osiControls(osiBtn.dataset.osi); return; }
  const fix = e.target.closest('[data-fix]');
  if (fix) { $('#faultSelect').value = 'none'; startJourney(); $('#journey').scrollIntoView({ behavior:'smooth', block:'start' }); return; }
  const trouble = e.target.closest('.trouble-card');
  if (trouble) { runDiagnostic(trouble.dataset.scenario); return; }
  const sw = e.target.closest('[data-switch]');
  if (sw) {
    const k = sw.dataset.switch;
    labSwitches[k] = !labSwitches[k];
    sw.classList.toggle('is-on', labSwitches[k]);
    sw.setAttribute('aria-pressed', String(labSwitches[k]));
    return;
  }
});
document.addEventListener('input', e => {
  if (e.target.matches('[data-input="cidr"]')) {
    const card = e.target.closest('.concept-card');
    if (card) runMini('subnet', card);
  }
  if (e.target.id === 'labLoss') updateLossLabel();
});
$('#journeyRun').addEventListener('click', journeyRunClick);
$('#journeyReset').addEventListener('click', resetJourney);
$('#labRun').addEventListener('click', startLab);
$('#osiSpeed').addEventListener('change', () => { if (osiPlaying) startOsi(); });

/* ------------------------------------------------------------
   8. BOOT
   ------------------------------------------------------------ */
function boot() {
  initChrome();
  initConceptIndex();
  initOsi();
  initJourney();
  initPlatform();
  renderTrouble();
  initLab();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
