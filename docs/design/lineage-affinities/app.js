(() => {
	const D = window.DATA;
	const SLOTS = [["weapons", "Arme", "🗡️"], ["armors", "Armure", "🛡️"], ["objects", "Objet", "💎"], ["potions", "Potion", "🧪"]];
	const AFFINITY_STAT_FACTOR = 0.9;
	const RESONANCE = [
		[2, "+1 souffle au début du combat"],
		[3, "+1 régénération de souffle pendant les 3 premiers tours"],
		[4, "+5 % de dégâts sur les actions signature de la lignée"]
	];
	const lineageById = Object.fromEntries(D.lineages.map(l => [l.id, l]));
	const el = (tag, cls, html) => {
		const e = document.createElement(tag);
		if (cls) {
			e.className = cls;
		}
		if (html !== undefined) {
			e.innerHTML = html;
		}
		return e;
	};

	// Bars
	document.querySelectorAll(".bars").forEach(box => {
		const rows = JSON.parse(box.dataset.bars);
		const max = Number(box.dataset.max);
		rows.forEach(([label, value, kind]) => {
			const row = el("div", "bar");
			row.append(el("div", "lbl", label));
			const track = el("div", "track");
			const fill = el("div", `fill ${kind ?? ""}`);
			track.append(fill);
			row.append(track, el("div", "num", value));
			box.append(row);
			requestAnimationFrame(() => setTimeout(() => {
				fill.style.width = `${Math.max(value / max * 100, value > 0 ? 1.5 : 0)}%`;
			}, 60));
		});
	});

	// Lineage action table
	const lt = document.getElementById("lineage-table");
	const shades = [1, .8, .62, .48, .36];
	D.lineages.forEach(l => {
		const row = el("div", "lin-row");
		row.append(el("div", "lin-name", `${l.emoji} ${l.name}<small>${l.classNames.join(" → ")}</small>`));
		const stack = el("div", "stack");
		const total = l.actions.reduce((s, a) => s + a[1], 0);
		l.actions.forEach(([name, pct], i) => {
			const seg = el("div", "", `${name} ${pct}%`);
			seg.style.width = `${pct / total * 100}%`;
			seg.style.background = l.color;
			seg.style.opacity = shades[i];
			seg.title = `${name} : ${pct} %`;
			stack.append(seg);
		});
		row.append(stack);
		const wrClass = l.winrate >= 49 ? (l.winrate > 51 ? "up" : "") : "down";
		row.append(el("div", `lin-wr wr ${wrClass}`, `${String(l.winrate).replace(".", ",")} %`));
		lt.append(row);
	});

	// Lineage cards
	const chip = it => {
		const stats = it.atk !== undefined
			? `${it.atk}/${it.dfn}/${it.spd}`
			: `${it.nature} ${it.power}`;
		return `<span class="chip" title="Atq/Déf/Vit ou nature + puissance · porteurs niv. 100+">${it.name} <span class="r">r${it.rarity}</span> · ${stats} · <span class="${it.eq === 0 ? "u0" : ""}">${it.eq} porteur${it.eq > 1 ? "s" : ""}</span></span>`;
	};
	const cards = document.getElementById("lineage-cards");
	const filters = document.getElementById("lineage-filters");
	const allBtn = el("button", "on", "Toutes");
	filters.append(allBtn);
	const setFilter = (id, btn) => {
		filters.querySelectorAll("button").forEach(b => b.classList.remove("on"));
		btn.classList.add("on");
		cards.querySelectorAll(".lin-card").forEach(c => c.classList.toggle("hidden", id !== null && c.dataset.id !== id));
	};
	allBtn.onclick = () => setFilter(null, allBtn);
	D.lineages.forEach(l => {
		const btn = el("button", "", `${l.emoji} ${l.name}`);
		btn.onclick = () => setFilter(l.id, btn);
		filters.append(btn);

		const card = el("div", "lin-card");
		card.dataset.id = l.id;
		card.style.setProperty("--c", l.color);
		card.innerHTML = `
			<div class="lin-head">
				<h3>${l.emoji} Lignée du ${l.name}</h3>
				<div class="meta">${l.players100} joueurs 100+<br>winrate ${String(l.winrate).replace(".", ",")} %</div>
			</div>
			<div class="lin-path">${l.classNames.join(" → ")}</div>
			<p class="lin-id">${l.identity}</p>`;
		const slots = el("div", "slots");
		SLOTS.forEach(([key, label, icon]) => {
			const [name, text] = l.effects[key];
			const s = el("div", "slot");
			s.innerHTML = `<div class="sh"><b>${icon} ${label} · ${name}</b><span>affinité ${l.name}</span></div>
				<div class="se">${text}</div>
				<div class="chips">${l.itemObjs[key].map(chip).join("")}</div>`;
			slots.append(s);
		});
		card.append(slots);
		const sig = l.signature;
		card.append(el("div", "sig", `<span class="tag t-sig">Signature</span> <b class="n">${sig.item.name}</b> (mythique) — <b>${sig.name}</b> : ${sig.text}<br><small>Porteurs niv. 100+ aujourd'hui : ${sig.item.eq}</small>`));
		cards.append(card);
	});

	// Workshop
	const pool = {};
	SLOTS.forEach(([key]) => {
		pool[key] = [{ group: "Neutres (sans affinité)", items: D.neutral[key].map(i => ({ ...i, affinity: null })) }];
		D.lineages.forEach(l => {
			const list = l.itemObjs[key].map(i => ({ ...i, affinity: l.id }));
			if (l.signature.cat === key) {
				list.unshift({ ...l.signature.item, affinity: l.id, signature: l.signature });
			}
			pool[key].push({ group: `${l.emoji} ${l.name}`, items: list });
		});
	});
	const flat = key => pool[key].flatMap(g => g.items);

	const clsSel = document.getElementById("ws-class");
	const tierFour = D.classes.filter(c => c.tier === 4);
	const others = D.classes.filter(c => c.tier !== 4);
	[["Palier 4", tierFour], ["Paliers 0–3", others]].forEach(([label, list]) => {
		const og = el("optgroup");
		og.label = label;
		list.forEach(c => {
			const o = el("option", "", `${lineageById[c.lineage].emoji} ${c.name} (palier ${c.tier})`);
			o.value = c.id;
			og.append(o);
		});
		clsSel.append(og);
	});
	clsSel.value = 21;

	const selects = {};
	SLOTS.forEach(([key]) => {
		const sel = document.getElementById(`ws-${key.slice(0, -1)}`);
		pool[key].forEach(g => {
			const og = el("optgroup");
			og.label = g.group;
			g.items.forEach((it, idx) => {
				const o = el("option", "", `${it.signature ? "★ " : ""}${it.name} (r${it.rarity})`);
				o.value = `${it.id}`;
				o.dataset.aff = it.affinity ?? "";
				og.append(o);
			});
			sel.append(og);
		});
		selects[key] = sel;
	});
	// Default: a Chevalier wearing the current meta
	selects.weapons.value = "89";
	selects.armors.value = "47";
	selects.objects.value = "4";
	selects.potions.value = "0";

	const intensityOf = tier => (tier <= 2 ? "I" : tier === 3 ? "II" : "III");
	const statLine = (it, factor) => {
		const fmt = v => (factor < 1 && v > 0 ? `<s>${v}</s> ${Math.round(v * factor)}` : `${v}`);
		if (it.atk !== undefined) {
			return `Atq ${fmt(it.atk)} · Déf ${fmt(it.dfn)} · Vit ${fmt(it.spd)}`;
		}
		return `${it.nature} · puissance ${fmt(it.power)}`;
	};

	const render = () => {
		const cls = D.classes.find(c => c.id === Number(clsSel.value));
		const lin = lineageById[cls.lineage];
		const intensity = intensityOf(cls.tier);
		let active = 0;
		const slotsBox = el("div", "ws-slots");
		const notes = [];
		SLOTS.forEach(([key, label, icon]) => {
			const opt = selects[key].selectedOptions[0];
			const it = flat(key).find(i => `${i.id}` === opt.value && (i.affinity ?? "") === opt.dataset.aff);
			const box = el("div", "ws-slot");
			const factor = it.affinity ? AFFINITY_STAT_FACTOR : 1;
			let effect;
			if (!it.affinity) {
				effect = `<div class="ef off">Item neutre : socle à 100 %, aucun effet.</div>`;
			}
			else if (it.affinity === lin.id) {
				active++;
				box.classList.add("on");
				const [name, text] = lin.effects[key];
				effect = `<div class="ef">✨ <b>${name}</b> <span class="intensity">${intensity}</span> — ${text}</div>`;
				if (it.signature) {
					effect += `<div class="ef" style="color:var(--sig)">★ <b>${it.signature.name}</b> — ${it.signature.text}</div>`;
					notes.push(`Signature active : ${it.signature.name}`);
				}
			}
			else {
				const other = lineageById[it.affinity];
				effect = `<div class="ef off">${other.emoji} Affinité ${other.name}, inactive pour un ${lin.name}. L'item garde 90 % de son socle.</div>`;
			}
			box.innerHTML = `<div><b>${icon} ${it.name}</b> <small>r${it.rarity}</small></div><div class="st">${statLine(it, factor)}</div>${effect}`;
			slotsBox.append(box);
		});

		const side = el("div", "ws-side");
		side.innerHTML = `<div><b>${lin.emoji} ${cls.name}</b> — Lignée du ${lin.name}</div>
			<div class="muted">Palier ${cls.tier} → intensité <span class="intensity">${intensity}</span></div>
			<hr style="border-color:var(--line)">
			<div><span class="tag t-reso">Résonance</span> ${active}/4</div>
			<div class="reso-dots">${[0, 1, 2, 3].map(i => `<i class="${i < active ? "on" : ""}"></i>`).join("")}</div>
			<div class="reso-list">${RESONANCE.map(([n, t]) => `<div class="${active >= n ? "on" : ""}">${n} pièces : ${t}</div>`).join("")}</div>
			<hr style="border-color:var(--line)">
			<div>${active === 0
				? "Aucun effet de lignée : c'est le méta actuel, où les stats brutes font tout."
				: `${active} effet${active > 1 ? "s" : ""} de lignée actif${active > 1 ? "s" : ""}.`}</div>
			${notes.map(n => `<div style="color:var(--sig);margin-top:6px">★ ${n}</div>`).join("")}`;

		const out = document.getElementById("ws-out");
		out.replaceChildren(slotsBox, side);
	};
	[clsSel, ...Object.values(selects)].forEach(s => s.addEventListener("change", render));
	render();

	// Active TOC link
	const links = [...document.querySelectorAll(".toc a")];
	const obs = new IntersectionObserver(entries => {
		entries.forEach(e => {
			if (e.isIntersecting) {
				links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
			}
		});
	}, { rootMargin: "-40% 0px -55% 0px" });
	document.querySelectorAll("section[id]").forEach(s => obs.observe(s));
})();
