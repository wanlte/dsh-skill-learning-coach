import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { readState, saveState } from "./api.js";
import { METHOD_IDS, PURPOSE_KINDS, addNode, emptyFramework, nodeOf, parseFramework, pickCurrent, removeSubtree, replaceNode, workspaceOptions, } from "../shared/framework.js";
import css from './SettingsCard.module.css';
const PURPOSE_LABEL = {
    job: 'purposeJob',
    exam: 'purposeExam',
    interest: 'purposeInterest',
    'career-switch': 'purposeCareerSwitch',
};
const METHOD_LABEL = {
    feynman: 'methodFeynman',
    recall: 'methodRecall',
    spaced: 'methodSpaced',
    interleave: 'methodInterleave',
    pomodoro: 'methodPomodoro',
    sq3r: 'methodSq3r',
    cornell: 'methodCornell',
    custom: 'methodCustom',
};
const METHOD_DESC = {
    feynman: 'methodFeynmanDesc',
    recall: 'methodRecallDesc',
    spaced: 'methodSpacedDesc',
    interleave: 'methodInterleaveDesc',
    pomodoro: 'methodPomodoroDesc',
    sq3r: 'methodSq3rDesc',
    cornell: 'methodCornellDesc',
    custom: 'methodCustomDesc',
};
const STATUS_LABEL = {
    pending: 'statusPending',
    'assumed-known': 'statusAssumedKnown',
    gap: 'statusGap',
    drafted: 'statusDrafted',
    done: 'statusDone',
};
const MATERIAL_LABEL = {
    url: 'kindUrl',
    file: 'kindFile',
    book: 'kindBook',
};
const MATERIAL_KINDS_UI = ['url', 'file', 'book'];
function TextField({ label, value, hint, type = 'text', onCommit }) {
    const [text, setText] = useState(value);
    useEffect(() => { setText(value); }, [value]);
    return (_jsxs("label", { className: css.field, children: [_jsx("span", { className: css.label, children: label }), _jsx("input", { className: css.input, type: type, value: text, onChange: event => setText(event.target.value), onBlur: () => { if (text !== value)
                    onCommit(text); } }), hint === undefined ? null : _jsx("span", { className: css.hint, children: hint })] }));
}
export function SettingsCard({ t, ctx, close }) {
    const subscribe = useCallback((fn) => ctx.sessions.list.subscribe(fn), [ctx]);
    const snapshot = useCallback(() => ctx.sessions.list.getSnapshot(), [ctx]);
    const list = useSyncExternalStore(subscribe, snapshot);
    const options = useMemo(() => workspaceOptions(Object.values(list.byId)), [list]);
    const [picked, setPicked] = useState('');
    const selected = options.find(option => option.cwd === picked) ?? options[0];
    const sessionId = selected?.sessionId;
    const [draft, setDraft] = useState(null);
    const [load, setLoad] = useState({ status: 'loading', path: '', error: '' });
    const [saveError, setSaveError] = useState('');
    const [reload, setReload] = useState(0);
    const saveErrorRef = useRef('');
    useEffect(() => { saveErrorRef.current = saveError; }, [saveError]);
    const currentId = draft === null ? null : pickCurrent(draft);
    const [expanded, setExpanded] = useState(null);
    const [pendingRemove, setPendingRemove] = useState(null);
    useEffect(() => {
        if (sessionId === undefined)
            return;
        let cancelled = false;
        setLoad({ status: 'loading', path: '', error: '' });
        setDraft(null);
        readState(sessionId).then(view => {
            if (cancelled)
                return;
            setDraft(view.framework);
            setLoad({ status: 'ready', path: view.path, error: '' });
        }).catch((error) => {
            if (cancelled)
                return;
            setLoad({ status: 'error', path: '', error: error instanceof Error ? error.message : String(error) });
        });
        return () => { cancelled = true; };
    }, [sessionId, reload]);
    // 盘上文件被别处改动（AI 落盘、另一个窗口编辑）时自己刷进来，不用手动重载。
    // 正在输入或上次保存失败时让路，避免把用户手里没提交的文字冲掉。
    useEffect(() => {
        if (sessionId === undefined)
            return;
        let cancelled = false;
        const tick = () => {
            if (saveErrorRef.current !== '')
                return;
            const active = document.activeElement;
            if (active instanceof HTMLElement && active.matches('input, textarea, select'))
                return;
            readState(sessionId).then(view => {
                if (cancelled)
                    return;
                setDraft(previous => {
                    if (previous === null)
                        return view.framework;
                    return JSON.stringify(previous) === JSON.stringify(view.framework) ? previous : view.framework;
                });
                setLoad(previous => previous.status === 'ready' && previous.path === view.path
                    ? previous
                    : { status: 'ready', path: view.path, error: '' });
            }).catch(() => { });
        };
        const timer = setInterval(tick, 3000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [sessionId]);
    const commit = (next) => {
        if (sessionId === undefined)
            return;
        setDraft(next);
        let validated;
        try {
            validated = parseFramework(next);
        }
        catch (error) {
            setSaveError(error instanceof Error ? error.message : String(error));
            return;
        }
        setSaveError('');
        saveState(sessionId, validated).then(view => {
            setLoad({ status: 'ready', path: view.path, error: '' });
        }).catch((error) => {
            setSaveError(error instanceof Error ? error.message : String(error));
        });
    };
    if (options.length === 0)
        return _jsx("p", { className: css.hint, children: t('noWorkspace') });
    return (_jsxs("div", { className: css.card, children: [_jsxs("label", { className: css.field, children: [_jsx("span", { className: css.label, children: t('workspace') }), _jsx("select", { className: css.input, value: selected?.cwd ?? '', onChange: event => setPicked(event.target.value), children: options.map(option => _jsx("option", { value: option.cwd, children: option.cwd }, option.cwd)) })] }), load.status === 'loading' ? _jsx("p", { className: css.hint, children: t('loading') }) : null, load.status === 'error' ? (_jsxs("p", { className: css.error, children: [t('loadFailed'), ": ", load.error, _jsx("button", { type: "button", className: css.button, onClick: () => setReload(value => value + 1), children: t('retry') })] })) : null, load.path === '' ? null : _jsxs("p", { className: css.hint, children: [t('path'), ": ", load.path] }), load.status === 'ready' ? _jsx("p", { className: css.hint, children: t('liveSync') }) : null, saveError === '' ? null : (_jsxs("p", { className: css.error, children: [t('saveFailed'), ": ", saveError, _jsx("button", { type: "button", className: css.button, onClick: () => { if (draft !== null)
                            commit(draft); }, children: t('retry') })] })), load.status === 'ready' && draft === null ? (_jsxs("div", { className: css.section, children: [_jsx("p", { className: css.hint, children: t('emptyHint') }), _jsx("button", { type: "button", className: css.button, onClick: () => commit(emptyFramework(t('defaultTopic'))), children: t('createEmpty') }), _jsx("button", { type: "button", className: css.button, onClick: close, children: t('goToSession') })] })) : null, draft === null ? null : (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.section, children: [_jsx(TextField, { label: t('topic'), value: draft.topic, onCommit: next => commit({ ...draft, topic: next }) }), _jsxs("label", { className: css.field, children: [_jsx("span", { className: css.label, children: t('purpose') }), _jsx("select", { className: css.input, value: draft.purpose.kind, onChange: event => commit({ ...draft, purpose: { ...draft.purpose, kind: event.target.value } }), children: PURPOSE_KINDS.map(kind => _jsx("option", { value: kind, children: t(PURPOSE_LABEL[kind]) }, kind)) })] }), _jsx(TextField, { label: t('purposeDetail'), value: draft.purpose.detail, hint: draft.purpose.kind === 'job' ? t('purposeDetailJob') : draft.purpose.kind === 'exam' ? t('purposeDetailExam') : undefined, onCommit: next => commit({ ...draft, purpose: { ...draft.purpose, detail: next } }) }), _jsx(TextField, { label: t('deadline'), type: "date", value: draft.purpose.deadline ?? '', onCommit: next => commit({ ...draft, purpose: { ...draft.purpose, deadline: next === '' ? null : next } }) }), _jsx(TextField, { label: t('weeklyMinutes'), type: "number", hint: t('weeklyMinutesHint'), value: String(draft.weeklyMinutes), onCommit: next => {
                                    const value = Number.parseInt(next, 10);
                                    if (Number.isInteger(value) && value >= 0 && value <= 10080)
                                        commit({ ...draft, weeklyMinutes: value });
                                } })] }), _jsxs("div", { className: css.section, children: [_jsx("span", { className: css.label, children: t('framework') }), _jsxs("p", { className: css.hint, children: [t('nodeCount'), ": ", draft.nodes.length, " \u00B7 ", t('currentNode'), ": ", currentId ?? t('none')] }), _jsx("ul", { className: css.tree, children: draft.nodes.map(node => (_jsxs("li", { children: [_jsxs("div", { className: node.id === currentId ? css.nodeCurrent : css.node, children: [_jsx("span", { className: css.nodeId, children: node.id }), _jsx("button", { type: "button", className: css.nodeTitle, style: { background: 'none', border: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }, onClick: () => setExpanded(value => (value === node.id ? null : node.id)), children: node.title }), _jsx("span", { className: css.badge, children: t(STATUS_LABEL[node.status]) })] }), _jsxs("div", { className: css.nodeActions, children: [_jsx("button", { type: "button", className: css.button, onClick: () => commit({ ...draft, current: node.id }), children: t('select') }), _jsx("button", { type: "button", className: css.button, onClick: () => commit(replaceNode(draft, node.id, { status: 'gap' })), children: t('markGap') }), _jsx("button", { type: "button", className: css.button, onClick: () => commit(addNode(draft, node.id, t('nodeTitle'))), children: t('addChild') }), _jsx("button", { type: "button", className: css.button, onClick: () => {
                                                        if (pendingRemove === node.id) {
                                                            setPendingRemove(null);
                                                            setExpanded(value => (value === node.id ? null : value));
                                                            commit(removeSubtree(draft, node.id));
                                                        }
                                                        else {
                                                            setPendingRemove(node.id);
                                                        }
                                                    }, children: pendingRemove === node.id ? t('confirmRemove') : t('remove') })] }), expanded === node.id ? (_jsxs("div", { className: css.nodeBody, children: [_jsx(TextField, { label: t('nodeTitle'), value: node.title, onCommit: next => commit(replaceNode(draft, node.id, { title: next })) }), _jsx(TextField, { label: t('mastery'), value: node.mastery, hint: t('masteryHint'), onCommit: next => commit(replaceNode(draft, node.id, { mastery: next })) }), _jsx("span", { className: css.label, children: t('materials') }), node.materials.map((material, index) => (_jsxs("div", { className: css.material, children: [_jsxs("label", { className: css.field, children: [_jsx("span", { className: css.label, children: t('materialKind') }), _jsx("select", { className: css.input, value: material.kind, onChange: event => {
                                                                        const materials = node.materials.map((item, i) => (i === index ? { ...item, kind: event.target.value } : item));
                                                                        commit(replaceNode(draft, node.id, { materials }));
                                                                    }, children: MATERIAL_KINDS_UI.map(kind => _jsx("option", { value: kind, children: t(MATERIAL_LABEL[kind]) }, kind)) })] }), _jsx(TextField, { label: t('materialRef'), value: material.ref, onCommit: next => {
                                                                const materials = node.materials.map((item, i) => (i === index ? { ...item, ref: next } : item));
                                                                commit(replaceNode(draft, node.id, { materials }));
                                                            } }), _jsx(TextField, { label: t('materialLocator'), value: material.locator ?? '', onCommit: next => {
                                                                const materials = node.materials.map((item, i) => {
                                                                    if (i !== index)
                                                                        return item;
                                                                    const trimmed = next.trim();
                                                                    if (trimmed === '') {
                                                                        const { kind, ref, enough } = item;
                                                                        return { kind, ref, enough };
                                                                    }
                                                                    return { ...item, locator: trimmed };
                                                                });
                                                                commit(replaceNode(draft, node.id, { materials }));
                                                            } }), _jsx(TextField, { label: t('materialEnough'), value: material.enough, onCommit: next => {
                                                                const materials = node.materials.map((item, i) => (i === index ? { ...item, enough: next } : item));
                                                                commit(replaceNode(draft, node.id, { materials }));
                                                            } }), _jsx("button", { type: "button", className: css.button, onClick: () => commit(replaceNode(draft, node.id, { materials: node.materials.filter((_, i) => i !== index) })), children: t('removeMaterial') })] }, index))), _jsx("button", { type: "button", className: css.button, onClick: () => {
                                                        const material = { kind: 'url', ref: '', enough: '' };
                                                        commit(replaceNode(draft, node.id, { materials: [...node.materials, material] }));
                                                    }, children: t('addMaterial') }), nodeOf(draft, node.id).misconceptions.length === 0 ? null : (_jsxs(_Fragment, { children: [_jsx("span", { className: css.label, children: t('misconceptions') }), _jsx("ul", { className: css.mislist, children: nodeOf(draft, node.id).misconceptions.map((entry, index) => _jsx("li", { children: entry }, index)) })] }))] })) : null] }, node.id))) }), _jsx("button", { type: "button", className: css.button, onClick: () => commit(addNode(draft, null, t('nodeTitle'))), children: t('addRoot') })] }), _jsxs("div", { className: css.section, children: [_jsx("span", { className: css.label, children: t('method') }), _jsx("div", { className: css.methods, children: METHOD_IDS.map(id => (_jsxs("button", { type: "button", className: draft.method === id ? css.methodOn : css.method, onClick: () => commit({ ...draft, method: id, customMethod: id === 'custom' ? draft.customMethod ?? '' : null }), children: [_jsx("span", { className: css.methodName, children: t(METHOD_LABEL[id]) }), _jsx("span", { className: css.methodDesc, children: t(METHOD_DESC[id]) })] }, id))) }), draft.method === 'custom' ? (_jsx(TextField, { label: t('customMethod'), value: draft.customMethod ?? '', hint: t('customMethodHint'), onCommit: next => commit({ ...draft, customMethod: next.trim() === '' ? null : next.trim() }) })) : null] })] }))] }));
}
