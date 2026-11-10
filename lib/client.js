window.__ModuleLoader__.load({
	id: "dsh-skill-learning-coach",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		// src/client/api.ts
		var CoachApiError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
				this.name = "CoachApiError";
			}
		};
		function routeUrl(method) {
			const base = typeof document !== "undefined" && document.baseURI !== "" ? document.baseURI : "http://dsh.internal/";
			const url = new URL(base);
			url.search = "";
			url.hash = "";
			if (!url.pathname.endsWith("/")) url.pathname += "/";
			return new URL(`learning-coach/api/${method}`, url.href).href;
		}
		async function call(method, payload) {
			let response;
			try {
				response = await fetch(routeUrl(method), {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
				});
			} catch (error) {
				throw new CoachApiError("network", error instanceof Error ? error.message : String(error));
			}
			const parsed = await response.json().catch(() => null);
			if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === void 0) throw new CoachApiError(parsed?.error?.code ?? "http", parsed?.error?.message ?? `HTTP ${response.status}`);
			return parsed.value;
		}
		function readState(sessionId) {
			return call("state.read", { sessionId });
		}
		function saveState(sessionId, framework) {
			return call("state.write", {
				sessionId,
				framework
			});
		}
		// src/shared/framework.ts
		const PURPOSE_KINDS = [
			"job",
			"exam",
			"interest",
			"career-switch"
		];
		const NODE_STATUSES = [
			"pending",
			"assumed-known",
			"gap",
			"drafted",
			"done"
		];
		const METHOD_IDS = [
			"feynman",
			"recall",
			"spaced",
			"interleave",
			"pomodoro",
			"sq3r",
			"cornell",
			"custom"
		];
		const MATERIAL_KINDS = [
			"url",
			"file",
			"book"
		];
		var FrameworkError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
				this.name = "FrameworkError";
			}
		};
		const NODE_ID = /^[1-9][0-9]*(\.[1-9][0-9]*)*$/;
		const DATE = /^\d{4}-\d{2}-\d{2}$/;
		function fail(code, message) {
			throw new FrameworkError(code, message);
		}
		function requireObject(value, field) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) fail("bad-shape", `${field} 必须是对象`);
			return value;
		}
		function requireArray(value, field) {
			if (!Array.isArray(value)) fail("bad-shape", `${field} 必须是数组`);
			return value;
		}
		function requireString(value, field) {
			if (typeof value !== "string") fail("bad-shape", `${field} 必须是字符串`);
			return value;
		}
		function requireNonEmpty(value, field) {
			const text = requireString(value, field);
			if (text.trim() === "") fail("bad-shape", `${field} 不能为空`);
			return text;
		}
		function requireOneOf(value, allowed, field) {
			if (typeof value !== "string" || !allowed.includes(value)) fail("bad-shape", `${field} 必须是 ${allowed.join(" / ")} 之一`);
			return value;
		}
		function requireInt(value, field, max) {
			if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) fail("bad-shape", `${field} 必须是 0–${max} 的整数`);
			return value;
		}
		function requireDateOrNull(value, field) {
			if (value === null) return null;
			const text = requireString(value, field);
			if (!DATE.test(text)) fail("bad-shape", `${field} 必须是 YYYY-MM-DD 或 null`);
			return text;
		}
		function parseMaterial(input, field) {
			const row = requireObject(input, field);
			const material = {
				kind: requireOneOf(row.kind, MATERIAL_KINDS, `${field}.kind`),
				ref: requireNonEmpty(row.ref, `${field}.ref`),
				enough: requireString(row.enough, `${field}.enough`)
			};
			if (row.locator !== void 0 && row.locator !== null) {
				const locator = requireString(row.locator, `${field}.locator`).trim();
				if (locator !== "") material.locator = locator;
			}
			return material;
		}
		function parseNode(input, field) {
			const row = requireObject(input, field);
			const id = requireNonEmpty(row.id, `${field}.id`);
			if (!NODE_ID.test(id)) fail("bad-id", `${field}.id "${id}" 必须是 1 / 3.2 这样的层级编号`);
			const parent = row.parent === null ? null : requireNonEmpty(row.parent, `${field}.parent`);
			if (parent === null && id.includes(".")) fail("bad-parent", `${field} 是顶级节点，编号不能带点`);
			if (parent !== null && !id.startsWith(`${parent}.`)) fail("bad-parent", `${field}.parent "${parent}" 必须是编号 "${id}" 的上级`);
			return {
				id,
				parent,
				title: requireNonEmpty(row.title, `${field}.title`),
				status: requireOneOf(row.status, NODE_STATUSES, `${field}.status`),
				materials: requireArray(row.materials, `${field}.materials`).map((item, i) => parseMaterial(item, `${field}.materials[${i}]`)),
				mastery: requireString(row.mastery, `${field}.mastery`),
				misconceptions: requireArray(row.misconceptions, `${field}.misconceptions`).map((item, i) => requireNonEmpty(item, `${field}.misconceptions[${i}]`)),
				reviewOn: requireDateOrNull(row.reviewOn, `${field}.reviewOn`),
				lecture: row.lecture === null ? null : requireNonEmpty(row.lecture, `${field}.lecture`),
				minutesSpent: requireInt(row.minutesSpent, `${field}.minutesSpent`, 1e5)
			};
		}
		function parseFramework(input) {
			const row = requireObject(input, "framework");
			if (row.version !== 1) fail("bad-version", `framework.version 必须是 1，收到 ${JSON.stringify(row.version)}`);
			const purpose = requireObject(row.purpose, "purpose");
			const kind = requireOneOf(purpose.kind, PURPOSE_KINDS, "purpose.kind");
			const detail = requireString(purpose.detail, "purpose.detail");
			if ((kind === "job" || kind === "exam") && detail.trim() === "") fail("bad-purpose", kind === "job" ? "purpose.detail 必须写清目标岗位" : "purpose.detail 必须写清考试名");
			const method = requireOneOf(row.method, METHOD_IDS, "method");
			const customMethod = row.customMethod === null ? null : requireNonEmpty(row.customMethod, "customMethod");
			if (method === "custom" && customMethod === null) fail("bad-method", "选自定义方法时 customMethod 不能为空");
			if (method !== "custom" && customMethod !== null) fail("bad-method", "只有选自定义方法时才有 customMethod");
			const nodes = requireArray(row.nodes, "nodes").map((item, i) => parseNode(item, `nodes[${i}]`));
			const ids = /* @__PURE__ */ new Set();
			for (const node of nodes) {
				if (ids.has(node.id)) fail("duplicate-id", `节点编号 "${node.id}" 重复`);
				ids.add(node.id);
			}
			for (const node of nodes) if (node.parent !== null && !ids.has(node.parent)) fail("orphan-node", `节点 "${node.id}" 的上级 "${node.parent}" 不存在`);
			const current = row.current === null ? null : requireNonEmpty(row.current, "current");
			if (current !== null && !ids.has(current)) fail("bad-current", `current "${current}" 不是已有节点`);
			return {
				version: 1,
				topic: requireNonEmpty(row.topic, "topic"),
				purpose: {
					kind,
					detail,
					deadline: requireDateOrNull(purpose.deadline, "purpose.deadline")
				},
				weeklyMinutes: requireInt(row.weeklyMinutes, "weeklyMinutes", 10080),
				method,
				customMethod,
				current,
				nodes
			};
		}
		function emptyFramework(topic) {
			return {
				version: 1,
				topic,
				purpose: {
					kind: "interest",
					detail: "",
					deadline: null
				},
				weeklyMinutes: 0,
				method: "feynman",
				customMethod: null,
				current: null,
				nodes: []
			};
		}
		function nodeOf(fw, id) {
			const node = fw.nodes.find((item) => item.id === id);
			if (node === void 0) fail("unknown-node", `节点 "${id}" 不存在`);
			return node;
		}
		function replaceNode(fw, id, patch) {
			nodeOf(fw, id);
			return {
				...fw,
				nodes: fw.nodes.map((node) => node.id === id ? {
					...node,
					...patch,
					id: node.id
				} : node)
			};
		}
		function nextChildId(fw, parent) {
			const prefix = parent === null ? "" : `${parent}.`;
			let max = 0;
			for (const node of fw.nodes) {
				if (node.parent !== parent) continue;
				const value = Number(node.id.slice(prefix.length));
				if (Number.isInteger(value) && value > max) max = value;
			}
			return `${prefix}${max + 1}`;
		}
		function addNode(fw, parent, title) {
			if (parent !== null) nodeOf(fw, parent);
			const node = {
				id: nextChildId(fw, parent),
				parent,
				title,
				status: "pending",
				materials: [],
				mastery: "",
				misconceptions: [],
				reviewOn: null,
				lecture: null,
				minutesSpent: 0
			};
			const nodes = [...fw.nodes];
			if (parent === null) nodes.push(node);
			else {
				let at = nodes.findIndex((item) => item.id === parent) + 1;
				while (at < nodes.length && nodes[at].id.startsWith(`${parent}.`)) at += 1;
				nodes.splice(at, 0, node);
			}
			return {
				...fw,
				nodes
			};
		}
		function removeSubtree(fw, id) {
			nodeOf(fw, id);
			const nodes = fw.nodes.filter((node) => node.id !== id && !node.id.startsWith(`${id}.`));
			const lost = fw.current !== null && (fw.current === id || fw.current.startsWith(`${id}.`));
			return {
				...fw,
				nodes,
				current: lost ? null : fw.current
			};
		}
		function pickCurrent(fw) {
			if (fw.current !== null) return fw.current;
			return fw.nodes.find((node) => node.status !== "assumed-known" && node.status !== "done")?.id ?? null;
		}
		function workspaceOptions(rows) {
			const byCwd = /* @__PURE__ */ new Map();
			for (const row of rows) {
				if (row.origin === "subagent") continue;
				const cwd = row.cwd;
				if (cwd === void 0 || cwd === "") continue;
				const held = byCwd.get(cwd);
				if (held === void 0 || row.updatedAt > held.updatedAt) byCwd.set(cwd, {
					cwd,
					sessionId: row.id,
					updatedAt: row.updatedAt
				});
			}
			return [...byCwd.values()].sort((a, b) => b.updatedAt - a.updatedAt);
		}
		// \0dsh-css:src/client/SettingsCard.module.css.mjs
		const css = ".BxvuDG_card{flex-direction:column;gap:14px;padding:4px 2px 16px;display:flex}.BxvuDG_section{border:1px solid var(--divider-color,#80808040);border-radius:10px;flex-direction:column;gap:10px;padding:14px 16px;display:flex}.BxvuDG_field{flex-direction:column;gap:6px;display:flex}.BxvuDG_label{font-size:13px;font-weight:500}.BxvuDG_input{border:1px solid var(--divider-color,#80808059);color:inherit;font:inherit;background:0 0;border-radius:6px;padding:6px 8px;font-size:13px}.BxvuDG_hint{opacity:.65;margin:0;font-size:12px}.BxvuDG_error{color:var(--error-color,#d64545);align-items:center;gap:8px;margin:0;font-size:12px;display:flex}.BxvuDG_button{border:1px solid var(--divider-color,#80808059);color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:6px;align-self:flex-start;padding:5px 10px;font-size:12px}.BxvuDG_tree{flex-direction:column;gap:4px;margin:0;padding:0;list-style:none;display:flex}.BxvuDG_node,.BxvuDG_nodeCurrent{border-radius:6px;align-items:center;gap:8px;padding:6px 8px;font-size:13px;display:flex}.BxvuDG_nodeCurrent{border:1px solid var(--accent-color,#508cff80)}.BxvuDG_nodeId{opacity:.6;font-variant-numeric:tabular-nums;flex-shrink:0}.BxvuDG_nodeTitle{flex:1;min-width:0}.BxvuDG_badge{border:1px solid var(--divider-color,#80808059);opacity:.8;border-radius:999px;flex-shrink:0;padding:1px 6px;font-size:11px}.BxvuDG_methods{grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;display:grid}.BxvuDG_method,.BxvuDG_methodOn{border:1px solid var(--divider-color,#80808040);color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border-radius:8px;flex-direction:column;gap:4px;padding:10px 12px;display:flex}.BxvuDG_methodOn{border-color:var(--accent-color,#508cff80)}.BxvuDG_methodName{font-size:13px;font-weight:600}.BxvuDG_methodDesc{opacity:.65;font-size:11px}.BxvuDG_nodeActions{flex-wrap:wrap;gap:6px;display:flex}.BxvuDG_nodeBody{flex-direction:column;gap:10px;padding:10px 8px 4px;display:flex}.BxvuDG_material{border:1px solid var(--divider-color,#80808033);border-radius:6px;flex-direction:column;gap:6px;padding:8px;display:flex}.BxvuDG_mislist{opacity:.8;margin:0;padding-left:18px;font-size:12px}";
		const tagId = "dsh-skill-learning-coach/SettingsCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-skill-learning-coach";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SettingsCard_module_css_default = {
			"hint": "BxvuDG_hint",
			"label": "BxvuDG_label",
			"field": "BxvuDG_field",
			"error": "BxvuDG_error",
			"mislist": "BxvuDG_mislist",
			"card": "BxvuDG_card",
			"nodeTitle": "BxvuDG_nodeTitle",
			"tree": "BxvuDG_tree",
			"nodeCurrent": "BxvuDG_nodeCurrent",
			"methodName": "BxvuDG_methodName",
			"material": "BxvuDG_material",
			"methods": "BxvuDG_methods",
			"input": "BxvuDG_input",
			"nodeId": "BxvuDG_nodeId",
			"method": "BxvuDG_method",
			"methodOn": "BxvuDG_methodOn",
			"node": "BxvuDG_node",
			"section": "BxvuDG_section",
			"methodDesc": "BxvuDG_methodDesc",
			"nodeActions": "BxvuDG_nodeActions",
			"nodeBody": "BxvuDG_nodeBody",
			"badge": "BxvuDG_badge",
			"button": "BxvuDG_button"
		};
		// src/client/SettingsCard.tsx
		const PURPOSE_LABEL = {
			job: "purposeJob",
			exam: "purposeExam",
			interest: "purposeInterest",
			"career-switch": "purposeCareerSwitch"
		};
		const METHOD_LABEL = {
			feynman: "methodFeynman",
			recall: "methodRecall",
			spaced: "methodSpaced",
			interleave: "methodInterleave",
			pomodoro: "methodPomodoro",
			sq3r: "methodSq3r",
			cornell: "methodCornell",
			custom: "methodCustom"
		};
		const METHOD_DESC = {
			feynman: "methodFeynmanDesc",
			recall: "methodRecallDesc",
			spaced: "methodSpacedDesc",
			interleave: "methodInterleaveDesc",
			pomodoro: "methodPomodoroDesc",
			sq3r: "methodSq3rDesc",
			cornell: "methodCornellDesc",
			custom: "methodCustomDesc"
		};
		const STATUS_LABEL = {
			pending: "statusPending",
			"assumed-known": "statusAssumedKnown",
			gap: "statusGap",
			drafted: "statusDrafted",
			done: "statusDone"
		};
		const MATERIAL_LABEL = {
			url: "kindUrl",
			file: "kindFile",
			book: "kindBook"
		};
		const MATERIAL_KINDS_UI = [
			"url",
			"file",
			"book"
		];
		function TextField({ label, value, hint, type = "text", onCommit }) {
			const [text, setText] = (0, react.useState)(value);
			(0, react.useEffect)(() => {
				setText(value);
			}, [value]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: SettingsCard_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SettingsCard_module_css_default.label,
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: SettingsCard_module_css_default.input,
						type,
						value: text,
						onChange: (event) => setText(event.target.value),
						onBlur: () => {
							if (text !== value) onCommit(text);
						}
					}),
					hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SettingsCard_module_css_default.hint,
						children: hint
					})
				]
			});
		}
		function SettingsCard({ t, ctx, close }) {
			const subscribe = (0, react.useCallback)((fn) => ctx.sessions.list.subscribe(fn), [ctx]);
			const snapshot = (0, react.useCallback)(() => ctx.sessions.list.getSnapshot(), [ctx]);
			const list = (0, react.useSyncExternalStore)(subscribe, snapshot);
			const options = (0, react.useMemo)(() => workspaceOptions(Object.values(list.byId)), [list]);
			const [picked, setPicked] = (0, react.useState)("");
			const selected = options.find((option) => option.cwd === picked) ?? options[0];
			const sessionId = selected?.sessionId;
			const [draft, setDraft] = (0, react.useState)(null);
			const [load, setLoad] = (0, react.useState)({
				status: "loading",
				path: "",
				error: ""
			});
			const [saveError, setSaveError] = (0, react.useState)("");
			const [reload, setReload] = (0, react.useState)(0);
			const saveErrorRef = (0, react.useRef)("");
			(0, react.useEffect)(() => {
				saveErrorRef.current = saveError;
			}, [saveError]);
			const currentId = draft === null ? null : pickCurrent(draft);
			const [expanded, setExpanded] = (0, react.useState)(null);
			const [pendingRemove, setPendingRemove] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (sessionId === void 0) return;
				let cancelled = false;
				setLoad({
					status: "loading",
					path: "",
					error: ""
				});
				setDraft(null);
				readState(sessionId).then((view) => {
					if (cancelled) return;
					setDraft(view.framework);
					setLoad({
						status: "ready",
						path: view.path,
						error: ""
					});
				}).catch((error) => {
					if (cancelled) return;
					setLoad({
						status: "error",
						path: "",
						error: error instanceof Error ? error.message : String(error)
					});
				});
				return () => {
					cancelled = true;
				};
			}, [sessionId, reload]);
			(0, react.useEffect)(() => {
				if (sessionId === void 0) return;
				let cancelled = false;
				const tick = () => {
					if (saveErrorRef.current !== "") return;
					const active = document.activeElement;
					if (active instanceof HTMLElement && active.matches("input, textarea, select")) return;
					readState(sessionId).then((view) => {
						if (cancelled) return;
						setDraft((previous) => {
							if (previous === null) return view.framework;
							return JSON.stringify(previous) === JSON.stringify(view.framework) ? previous : view.framework;
						});
						setLoad((previous) => previous.status === "ready" && previous.path === view.path ? previous : {
							status: "ready",
							path: view.path,
							error: ""
						});
					}).catch(() => {});
				};
				const timer = setInterval(tick, 3e3);
				return () => {
					cancelled = true;
					clearInterval(timer);
				};
			}, [sessionId]);
			const commit = (next) => {
				if (sessionId === void 0) return;
				setDraft(next);
				let validated;
				try {
					validated = parseFramework(next);
				} catch (error) {
					setSaveError(error instanceof Error ? error.message : String(error));
					return;
				}
				setSaveError("");
				saveState(sessionId, validated).then((view) => {
					setLoad({
						status: "ready",
						path: view.path,
						error: ""
					});
				}).catch((error) => {
					setSaveError(error instanceof Error ? error.message : String(error));
				});
			};
			if (options.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: SettingsCard_module_css_default.hint,
				children: t("noWorkspace")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SettingsCard_module_css_default.card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: SettingsCard_module_css_default.field,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SettingsCard_module_css_default.label,
							children: t("workspace")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							className: SettingsCard_module_css_default.input,
							value: selected?.cwd ?? "",
							onChange: (event) => setPicked(event.target.value),
							children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: option.cwd,
								children: option.cwd
							}, option.cwd))
						})]
					}),
					load.status === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SettingsCard_module_css_default.hint,
						children: t("loading")
					}) : null,
					load.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: SettingsCard_module_css_default.error,
						children: [
							t("loadFailed"),
							": ",
							load.error,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SettingsCard_module_css_default.button,
								onClick: () => setReload((value) => value + 1),
								children: t("retry")
							})
						]
					}) : null,
					load.path === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: SettingsCard_module_css_default.hint,
						children: [
							t("path"),
							": ",
							load.path
						]
					}),
					load.status === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SettingsCard_module_css_default.hint,
						children: t("liveSync")
					}) : null,
					saveError === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: SettingsCard_module_css_default.error,
						children: [
							t("saveFailed"),
							": ",
							saveError,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SettingsCard_module_css_default.button,
								onClick: () => {
									if (draft !== null) commit(draft);
								},
								children: t("retry")
							})
						]
					}),
					load.status === "ready" && draft === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SettingsCard_module_css_default.section,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: SettingsCard_module_css_default.hint,
								children: t("emptyHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SettingsCard_module_css_default.button,
								onClick: () => commit(emptyFramework(t("defaultTopic"))),
								children: t("createEmpty")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SettingsCard_module_css_default.button,
								onClick: close,
								children: t("goToSession")
							})
						]
					}) : null,
					draft === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SettingsCard_module_css_default.section,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
									label: t("topic"),
									value: draft.topic,
									onCommit: (next) => commit({
										...draft,
										topic: next
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: SettingsCard_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SettingsCard_module_css_default.label,
										children: t("purpose")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: SettingsCard_module_css_default.input,
										value: draft.purpose.kind,
										onChange: (event) => commit({
											...draft,
											purpose: {
												...draft.purpose,
												kind: event.target.value
											}
										}),
										children: PURPOSE_KINDS.map((kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: kind,
											children: t(PURPOSE_LABEL[kind])
										}, kind))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
									label: t("purposeDetail"),
									value: draft.purpose.detail,
									hint: draft.purpose.kind === "job" ? t("purposeDetailJob") : draft.purpose.kind === "exam" ? t("purposeDetailExam") : void 0,
									onCommit: (next) => commit({
										...draft,
										purpose: {
											...draft.purpose,
											detail: next
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
									label: t("deadline"),
									type: "date",
									value: draft.purpose.deadline ?? "",
									onCommit: (next) => commit({
										...draft,
										purpose: {
											...draft.purpose,
											deadline: next === "" ? null : next
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
									label: t("weeklyMinutes"),
									type: "number",
									hint: t("weeklyMinutesHint"),
									value: String(draft.weeklyMinutes),
									onCommit: (next) => {
										const value = Number.parseInt(next, 10);
										if (Number.isInteger(value) && value >= 0 && value <= 10080) commit({
											...draft,
											weeklyMinutes: value
										});
									}
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SettingsCard_module_css_default.section,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SettingsCard_module_css_default.label,
									children: t("framework")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: SettingsCard_module_css_default.hint,
									children: [
										t("nodeCount"),
										": ",
										draft.nodes.length,
										" · ",
										t("currentNode"),
										": ",
										currentId ?? t("none")
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: SettingsCard_module_css_default.tree,
									children: draft.nodes.map((node) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: node.id === currentId ? SettingsCard_module_css_default.nodeCurrent : SettingsCard_module_css_default.node,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: SettingsCard_module_css_default.nodeId,
													children: node.id
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: SettingsCard_module_css_default.nodeTitle,
													style: {
														background: "none",
														border: "none",
														color: "inherit",
														font: "inherit",
														textAlign: "left",
														cursor: "pointer"
													},
													onClick: () => setExpanded((value) => value === node.id ? null : node.id),
													children: node.title
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: SettingsCard_module_css_default.badge,
													children: t(STATUS_LABEL[node.status])
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: SettingsCard_module_css_default.nodeActions,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: SettingsCard_module_css_default.button,
													onClick: () => commit({
														...draft,
														current: node.id
													}),
													children: t("select")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: SettingsCard_module_css_default.button,
													onClick: () => commit(replaceNode(draft, node.id, { status: "gap" })),
													children: t("markGap")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: SettingsCard_module_css_default.button,
													onClick: () => commit(addNode(draft, node.id, t("nodeTitle"))),
													children: t("addChild")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: SettingsCard_module_css_default.button,
													onClick: () => {
														if (pendingRemove === node.id) {
															setPendingRemove(null);
															setExpanded((value) => value === node.id ? null : value);
															commit(removeSubtree(draft, node.id));
														} else setPendingRemove(node.id);
													},
													children: pendingRemove === node.id ? t("confirmRemove") : t("remove")
												})
											]
										}),
										expanded === node.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: SettingsCard_module_css_default.nodeBody,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
													label: t("nodeTitle"),
													value: node.title,
													onCommit: (next) => commit(replaceNode(draft, node.id, { title: next }))
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
													label: t("mastery"),
													value: node.mastery,
													hint: t("masteryHint"),
													onCommit: (next) => commit(replaceNode(draft, node.id, { mastery: next }))
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: SettingsCard_module_css_default.label,
													children: t("materials")
												}),
												node.materials.map((material, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: SettingsCard_module_css_default.material,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
															className: SettingsCard_module_css_default.field,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: SettingsCard_module_css_default.label,
																children: t("materialKind")
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
																className: SettingsCard_module_css_default.input,
																value: material.kind,
																onChange: (event) => {
																	const materials = node.materials.map((item, i) => i === index ? {
																		...item,
																		kind: event.target.value
																	} : item);
																	commit(replaceNode(draft, node.id, { materials }));
																},
																children: MATERIAL_KINDS_UI.map((kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: kind,
																	children: t(MATERIAL_LABEL[kind])
																}, kind))
															})]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
															label: t("materialRef"),
															value: material.ref,
															onCommit: (next) => {
																const materials = node.materials.map((item, i) => i === index ? {
																	...item,
																	ref: next
																} : item);
																commit(replaceNode(draft, node.id, { materials }));
															}
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
															label: t("materialLocator"),
															value: material.locator ?? "",
															onCommit: (next) => {
																const materials = node.materials.map((item, i) => {
																	if (i !== index) return item;
																	const trimmed = next.trim();
																	if (trimmed === "") {
																		const { kind, ref, enough } = item;
																		return {
																			kind,
																			ref,
																			enough
																		};
																	}
																	return {
																		...item,
																		locator: trimmed
																	};
																});
																commit(replaceNode(draft, node.id, { materials }));
															}
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
															label: t("materialEnough"),
															value: material.enough,
															onCommit: (next) => {
																const materials = node.materials.map((item, i) => i === index ? {
																	...item,
																	enough: next
																} : item);
																commit(replaceNode(draft, node.id, { materials }));
															}
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: SettingsCard_module_css_default.button,
															onClick: () => commit(replaceNode(draft, node.id, { materials: node.materials.filter((_, i) => i !== index) })),
															children: t("removeMaterial")
														})
													]
												}, index)),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: SettingsCard_module_css_default.button,
													onClick: () => {
														const material = {
															kind: "url",
															ref: "",
															enough: ""
														};
														commit(replaceNode(draft, node.id, { materials: [...node.materials, material] }));
													},
													children: t("addMaterial")
												}),
												nodeOf(draft, node.id).misconceptions.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: SettingsCard_module_css_default.label,
													children: t("misconceptions")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
													className: SettingsCard_module_css_default.mislist,
													children: nodeOf(draft, node.id).misconceptions.map((entry, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: entry }, index))
												})] })
											]
										}) : null
									] }, node.id))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: SettingsCard_module_css_default.button,
									onClick: () => commit(addNode(draft, null, t("nodeTitle"))),
									children: t("addRoot")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SettingsCard_module_css_default.section,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SettingsCard_module_css_default.label,
									children: t("method")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: SettingsCard_module_css_default.methods,
									children: METHOD_IDS.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: draft.method === id ? SettingsCard_module_css_default.methodOn : SettingsCard_module_css_default.method,
										onClick: () => commit({
											...draft,
											method: id,
											customMethod: id === "custom" ? draft.customMethod ?? "" : null
										}),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SettingsCard_module_css_default.methodName,
											children: t(METHOD_LABEL[id])
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SettingsCard_module_css_default.methodDesc,
											children: t(METHOD_DESC[id])
										})]
									}, id))
								}),
								draft.method === "custom" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
									label: t("customMethod"),
									value: draft.customMethod ?? "",
									hint: t("customMethodHint"),
									onCommit: (next) => commit({
										...draft,
										customMethod: next.trim() === "" ? null : next.trim()
									})
								}) : null
							]
						})
					] })
				]
			});
		}
		// src/client/locales.ts
		const zh = {
			settingsTitle: "学习路线",
			workspace: "工作区",
			noWorkspace: "还没有带工作区的会话。先在 DSH 里打开一个项目，再回来看这张卡。",
			loading: "正在读取…",
			loadFailed: "读取失败",
			saveFailed: "保存失败",
			retry: "重试",
			path: "状态文件",
			liveSync: "每 3 秒从盘上同步；正在输入时先让路",
			emptyHint: "这个工作区还没有路线框架。在会话里说「我想学 X」，AI 会问清目的再生成；也可以先在这里建一个空的自己填。",
			createEmpty: "建一个空框架",
			goToSession: "去开会话",
			defaultTopic: "我的学习主题",
			topic: "学什么",
			purpose: "为什么学",
			purposeJob: "为了工作",
			purposeExam: "为了考试",
			purposeInterest: "兴趣",
			purposeCareerSwitch: "转行",
			purposeDetail: "具体目标",
			purposeDetailJob: "写清目标岗位，例如「后端求职面试」。岗位决定达标动作长什么样。",
			purposeDetailExam: "写清考试名，例如「408 统考」。考试决定达标动作是限时答对真题。",
			deadline: "期限",
			weeklyMinutes: "每周真能投入的分钟数",
			weeklyMinutesHint: "按过去一周实际花的时间填，不按理想计划。0–10080。",
			framework: "路线框架",
			nodeCount: "节点数",
			currentNode: "当前节",
			none: "无",
			nodeTitle: "节点标题",
			addRoot: "加一个顶级节点",
			addChild: "加子节",
			remove: "删除",
			confirmRemove: "再点一次确认删除（连子节一起）",
			select: "从这开始学",
			markGap: "标没懂",
			materials: "资料",
			materialKind: "类型",
			kindUrl: "链接",
			kindFile: "本地文件",
			kindBook: "书 / 章节",
			materialRef: "地址或书名",
			materialLocator: "位置（章节 / 页码 / 段落）",
			materialEnough: "读到什么程度算够",
			addMaterial: "加一份资料",
			removeMaterial: "删掉这份",
			mastery: "达标标准（一件可验证的动作）",
			masteryHint: "禁止「读完某章」「理解某概念」。要写成做出来的事，例如「不看资料画出三段报文交换图」。",
			misconceptions: "卡壳档案（只追加，AI 下次会话会引用）",
			method: "学习方法",
			methodFeynman: "费曼技巧",
			methodFeynmanDesc: "讲给新人听 → 找卡壳 → 简化重讲",
			methodRecall: "主动回忆",
			methodRecallDesc: "合上资料先答，再对照补漏",
			methodSpaced: "间隔重复",
			methodSpacedDesc: "按遗忘曲线排复习日（+1/+3/+7/+14/+30）",
			methodInterleave: "交错练习",
			methodInterleaveDesc: "相邻主题混着练，不刷同一类题",
			methodPomodoro: "番茄钟 + 刻意练习",
			methodPomodoroDesc: "25 分钟一块，只练最弱那一点",
			methodSq3r: "SQ3R 精读",
			methodSq3rDesc: "浏览-提问-读-复述-复习，啃官方文档",
			methodCornell: "康奈尔笔记",
			methodCornellDesc: "线索栏 / 笔记栏 / 总结栏",
			methodCustom: "自定义",
			methodCustomDesc: "填你自己的方法，AI 按它执行",
			customMethod: "你的方法怎么做",
			customMethodHint: "写清步骤，AI 会照着带练。填完失焦才算选定。",
			statusPending: "还没问",
			statusAssumedKnown: "默认已懂",
			statusGap: "没懂",
			statusDrafted: "已出讲义",
			statusDone: "已达标"
		};
		const en = {
			settingsTitle: "Learning roadmap",
			workspace: "Workspace",
			noWorkspace: "No session with a workspace yet. Open a project in DSH, then come back.",
			loading: "Loading…",
			loadFailed: "Read failed",
			saveFailed: "Save failed",
			retry: "Retry",
			path: "State file",
			liveSync: "Syncs from disk every 3s; pauses while you type",
			emptyHint: "No roadmap in this workspace yet. Say \"I want to learn X\" in a session and the coach will ask your purpose first, then generate one. Or create an empty one here.",
			createEmpty: "Create empty roadmap",
			goToSession: "Open a session",
			defaultTopic: "My topic",
			topic: "Topic",
			purpose: "Purpose",
			purposeJob: "For a job",
			purposeExam: "For an exam",
			purposeInterest: "Interest",
			purposeCareerSwitch: "Career switch",
			purposeDetail: "Concrete target",
			purposeDetailJob: "Name the target role, e.g. \"backend interview\". The role shapes what mastery looks like.",
			purposeDetailExam: "Name the exam, e.g. \"408 national exam\". The exam makes mastery a timed past-paper answer.",
			deadline: "Deadline",
			weeklyMinutes: "Minutes you can really invest per week",
			weeklyMinutesHint: "Use what you actually spent last week, not an ideal plan. 0–10080.",
			framework: "Roadmap",
			nodeCount: "Nodes",
			currentNode: "Current",
			none: "none",
			nodeTitle: "Node title",
			addRoot: "Add top-level node",
			addChild: "Add child",
			remove: "Delete",
			confirmRemove: "Click again to delete (with children)",
			select: "Start here",
			markGap: "Mark as gap",
			materials: "Materials",
			materialKind: "Kind",
			kindUrl: "URL",
			kindFile: "Local file",
			kindBook: "Book / chapter",
			materialRef: "Address or title",
			materialLocator: "Where (section / page / paragraph)",
			materialEnough: "How far is enough",
			addMaterial: "Add material",
			removeMaterial: "Remove",
			mastery: "Mastery (one verifiable action)",
			masteryHint: "Not \"finish chapter 3\" or \"understand X\". Write something you DO, e.g. \"draw the three-way handshake from memory\".",
			misconceptions: "Gap log (append-only; the coach cites it next session)",
			method: "Learning method",
			methodFeynman: "Feynman",
			methodFeynmanDesc: "Teach a newcomer → find the gap → simplify and reteach",
			methodRecall: "Active recall",
			methodRecallDesc: "Close the material, answer first, then check",
			methodSpaced: "Spaced repetition",
			methodSpacedDesc: "Review dates on the forgetting curve (+1/+3/+7/+14/+30)",
			methodInterleave: "Interleaving",
			methodInterleaveDesc: "Mix neighbouring topics instead of drilling one kind",
			methodPomodoro: "Pomodoro + deliberate practice",
			methodPomodoroDesc: "25-minute blocks spent only on the weakest point",
			methodSq3r: "SQ3R",
			methodSq3rDesc: "Survey-Question-Read-Recite-Review for official docs",
			methodCornell: "Cornell notes",
			methodCornellDesc: "Cue column / note column / summary",
			methodCustom: "Custom",
			methodCustomDesc: "Describe your own method; the coach follows it",
			customMethod: "How your method works",
			customMethodHint: "Write the steps. Blur the field to confirm the choice.",
			statusPending: "Not asked",
			statusAssumedKnown: "Assumed known",
			statusGap: "Gap",
			statusDrafted: "Lecture drafted",
			statusDone: "Mastered"
		};
		// src/client/index.ts
		const name = "dsh-skill-learning-coach-client";
		const inject = [
			"slots",
			"locale",
			"sessions"
		];
		const LOCALE_NS = "learning.coach";
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(LOCALE_NS, {
				zh,
				en
			}), "dsh-skill-learning-coach: dictionaries");
			const t = ctx.locale.bind(LOCALE_NS);
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "learning-coach",
				order: 30,
				label: () => t("settingsTitle"),
				locale: LOCALE_NS,
				inject: () => ({ ctx })
			}, SettingsCard)), "dsh-skill-learning-coach: settings section");
		}
		exports.LOCALE_NS = LOCALE_NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map