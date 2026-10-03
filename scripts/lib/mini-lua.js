'use strict';
// Minimal Lua 5.4 tree-walking interpreter built on luaparse.
//
// There is no Lua runtime on the dev machines or in CI, so regression tests
// that must exercise REAL resource code (not a JS re-implementation) run the
// pure-Lua modules through this interpreter with mocked FiveM/oxmysql globals.
// Supported: locals/globals, closures, varargs, multiple returns, method calls,
// tables, numeric/generic for, while/repeat, break, pcall/error, string methods
// with Lua patterns (common subset), string.format, table/math/os helpers.
// Not supported: goto, coroutines, metatables beyond __index.

const luaparse = require('luaparse');

class LuaError extends Error {
    constructor(value) {
        super(typeof value === 'string' ? value : 'lua error object');
        this.value = value;
    }
}

class LuaTable {
    constructor() { this.hash = new Map(); this.metatable = null; }
    get(key) {
        const v = this.hash.get(key);
        if (v !== undefined) return v;
        const index = this.metatable && this.metatable.get('__index');
        if (index instanceof LuaTable) return index.get(key);
        if (typeof index === 'function') return first(index(this, key));
        return undefined;
    }
    rawget(key) { return this.hash.get(key); }
    set(key, value) {
        if (key === undefined) throw new LuaError('table index is nil');
        if (value === undefined) this.hash.delete(key); else this.hash.set(key, value);
    }
    length() { let n = 0; while (this.hash.has(n + 1)) n++; return n; }
}

const first = (values) => (Array.isArray(values) ? values[0] : values);
const truthy = (v) => v !== undefined && v !== null && v !== false;

function luaType(v) {
    if (v === undefined || v === null) return 'nil';
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'function') return 'function';
    if (v instanceof LuaTable) return 'table';
    return 'userdata';
}

function numToString(n) {
    if (Number.isInteger(n)) return String(n);
    if (!Number.isFinite(n)) return n > 0 ? 'inf' : n < 0 ? '-inf' : 'nan';
    return String(Number(n.toPrecision(14)));
}

function tostring(v) {
    if (v === undefined || v === null) return 'nil';
    if (typeof v === 'number') return numToString(v);
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return String(v);
    if (v instanceof LuaTable) return 'table';
    if (typeof v === 'function') return 'function';
    return String(v);
}

function tonumber(v, base) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    if (base) { const n = parseInt(s, base); return Number.isNaN(n) ? undefined : n; }
    if (/^-?0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16);
    if (!/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return undefined;
    return Number(s);
}

// ── Lua patterns → JS RegExp (common subset) ──────────────────────────
const CLASS = {
    a: 'A-Za-z', d: '0-9', l: 'a-z', s: ' \\t\\n\\r\\f\\v', u: 'A-Z', w: 'A-Za-z0-9',
    x: 'A-Fa-f0-9', p: '!-\\/:-@\\[-`{-~', c: '\\x00-\\x1f\\x7f',
};
function patternToRegex(pat, flags = '') {
    let out = '';
    let i = 0;
    const escapeChar = (ch) => (/[\\^$.*+?()[\]{}|\/-]/.test(ch) ? '\\' + ch : ch);
    while (i < pat.length) {
        const ch = pat[i];
        let item = null;
        if (ch === '^' && i === 0) { out += '^'; i++; continue; }
        if (ch === '$' && i === pat.length - 1) { out += '$'; i++; continue; }
        if (ch === '%') {
            const c = pat[i + 1];
            if (CLASS[c]) item = `[${CLASS[c]}]`;
            else if (CLASS[c && c.toLowerCase()]) item = `[^${CLASS[c.toLowerCase()]}]`;
            else item = escapeChar(c);
            i += 2;
        } else if (ch === '[') {
            let j = i + 1;
            let set = '[';
            if (pat[j] === '^') { set += '^'; j++; }
            let firstChar = true;
            while (j < pat.length && (pat[j] !== ']' || firstChar)) {
                firstChar = false;
                if (pat[j] === '%') {
                    const c = pat[j + 1];
                    if (CLASS[c]) set += CLASS[c];
                    else if (CLASS[c && c.toLowerCase()]) throw new Error(`unsupported negated class in set: %${c}`);
                    else set += escapeChar(c);
                    j += 2;
                } else if (pat[j + 1] === '-' && pat[j + 2] && pat[j + 2] !== ']') {
                    set += escapeChar(pat[j]) + '-' + escapeChar(pat[j + 2]);
                    j += 3;
                } else {
                    set += escapeChar(pat[j]);
                    j++;
                }
            }
            item = set + ']';
            i = j + 1;
        } else if (ch === '.') { item = '[\\s\\S]'; i++; }
        else if (ch === '(') { out += pat[i + 1] === ')' ? '()' : '('; i += pat[i + 1] === ')' ? 2 : 1; continue; }
        else if (ch === ')') { out += ')'; i++; continue; }
        else { item = escapeChar(ch); i++; }
        const q = pat[i];
        if (q === '*' || q === '+' || q === '?') { out += item + q; i++; }
        else if (q === '-') { out += item + '*?'; i++; }
        else out += item;
    }
    return new RegExp(out, flags);
}

function luaFormat(fmt, args) {
    let ai = 0;
    return fmt.replace(/%([-+ #0]*)(\d*)(?:\.(\d+))?([sdifxXqc%])/g, (all, fl, width, prec, conv) => {
        if (conv === '%') return '%';
        const v = args[ai++];
        let s;
        switch (conv) {
            case 'd': case 'i': {
                const n = tonumber(v);
                if (n === undefined) throw new LuaError(`bad argument to 'format' (number expected, got ${luaType(v)})`);
                s = String(Math.trunc(n));
                break;
            }
            case 'f': s = (tonumber(v) || 0).toFixed(prec === undefined ? 6 : Number(prec)); break;
            case 'x': s = Math.trunc(tonumber(v) || 0).toString(16); break;
            case 'X': s = Math.trunc(tonumber(v) || 0).toString(16).toUpperCase(); break;
            case 'c': s = String.fromCharCode(tonumber(v) || 0); break;
            case 'q': s = JSON.stringify(tostring(v)); break;
            default: s = tostring(v); if (prec !== undefined) s = s.slice(0, Number(prec));
        }
        if (width && s.length < Number(width)) {
            const pad = fl.includes('0') && conv !== 's' ? '0' : ' ';
            s = fl.includes('-') ? s.padEnd(Number(width), ' ') : s.padStart(Number(width), pad);
        }
        return s;
    });
}

function createStdlib(G, output) {
    const fn = (f) => (...args) => { const r = f(...args); return Array.isArray(r) ? r : [r]; };
    const lib = (obj) => { const t = new LuaTable(); for (const [k, v] of Object.entries(obj)) t.set(k, v); return t; };

    const next = (t, k) => {
        const keys = [...t.hash.keys()];
        const idx = k === undefined ? 0 : keys.indexOf(k) + 1;
        if (idx >= keys.length) return [undefined];
        return [keys[idx], t.hash.get(keys[idx])];
    };

    const string = lib({
        len: fn((s) => Buffer.byteLength(tostring(s), 'utf8')),
        sub: fn((s, i, j) => {
            s = tostring(s);
            const len = s.length;
            i = i === undefined ? 1 : i; j = j === undefined ? -1 : j;
            if (i < 0) i = Math.max(len + i + 1, 1); else if (i === 0) i = 1;
            if (j < 0) j = len + j + 1; else if (j > len) j = len;
            return i > j ? '' : s.slice(i - 1, j);
        }),
        lower: fn((s) => tostring(s).toLowerCase()),
        upper: fn((s) => tostring(s).toUpperCase()),
        rep: fn((s, n) => tostring(s).repeat(Math.max(0, n))),
        byte: fn((s, i) => tostring(s).charCodeAt((i || 1) - 1)),
        char: (...codes) => [String.fromCharCode(...codes)],
        format: (fmt, ...args) => [luaFormat(tostring(fmt), args)],
        find: (s, pat, init, plain) => {
            s = tostring(s); init = init || 1;
            if (init < 0) init = Math.max(s.length + init + 1, 1);
            if (plain) {
                const idx = s.indexOf(pat, init - 1);
                return idx < 0 ? [undefined] : [idx + 1, idx + pat.length];
            }
            const re = patternToRegex(pat, 'g');
            if (pat.startsWith('^') && init > 1) return [undefined];
            re.lastIndex = init - 1;
            const m = re.exec(s);
            if (!m || (pat.startsWith('^') && m.index !== init - 1)) return [undefined];
            return [m.index + 1, m.index + m[0].length, ...m.slice(1)];
        },
        match: (s, pat, init) => {
            s = tostring(s);
            const re = patternToRegex(pat);
            const m = re.exec(init ? s.slice(init - 1) : s);
            if (!m) return [undefined];
            return m.length > 1 ? m.slice(1) : [m[0]];
        },
        gmatch: (s, pat) => {
            s = tostring(s);
            const re = patternToRegex(pat, 'g');
            return [() => {
                const m = re.exec(s);
                if (!m) return [undefined];
                if (m[0] === '') re.lastIndex++;
                return m.length > 1 ? m.slice(1) : [m[0]];
            }];
        },
        gsub: (s, pat, repl, maxN) => {
            s = tostring(s);
            const re = patternToRegex(pat, 'g');
            let count = 0;
            const result = s.replace(re, (...m) => {
                if (maxN !== undefined && count >= maxN) return m[0];
                count++;
                const caps = m.slice(1, -2);
                const whole = m[0];
                let r;
                if (typeof repl === 'string') {
                    r = repl.replace(/%([0-9%])/g, (a, d) => (d === '%' ? '%' : d === '0' ? whole : (caps[Number(d) - 1] ?? whole)));
                    return r;
                }
                const key = caps.length ? caps[0] : whole;
                if (repl instanceof LuaTable) r = repl.get(key);
                else if (typeof repl === 'function') r = first(repl(...(caps.length ? caps : [whole])));
                return truthy(r) ? tostring(r) : whole;
            });
            return [result, count];
        },
    });

    const table = lib({
        insert: (t, a, b) => {
            if (b === undefined) { t.set(t.length() + 1, a); return []; }
            const n = t.length();
            for (let i = n; i >= a; i--) t.set(i + 1, t.get(i));
            t.set(a, b);
            return [];
        },
        remove: (t, pos) => {
            const n = t.length();
            if (n === 0) return [undefined];
            pos = pos === undefined ? n : pos;
            const v = t.get(pos);
            for (let i = pos; i < n; i++) t.set(i, t.get(i + 1));
            t.set(n, undefined);
            return [v];
        },
        concat: fn((t, sep, i, j) => {
            const out = [];
            for (let k = i || 1; k <= (j || t.length()); k++) out.push(tostring(t.get(k)));
            return out.join(sep || '');
        }),
        sort: (t, cmp) => {
            const n = t.length();
            const arr = [];
            for (let i = 1; i <= n; i++) arr.push(t.get(i));
            arr.sort((a, b) => {
                if (cmp) return truthy(first(cmp(a, b))) ? -1 : truthy(first(cmp(b, a))) ? 1 : 0;
                return a < b ? -1 : a > b ? 1 : 0;
            });
            arr.forEach((v, i) => t.set(i + 1, v));
            return [];
        },
        unpack: (t, i, j) => {
            const out = [];
            for (let k = i || 1; k <= (j || t.length()); k++) out.push(t.get(k));
            return out;
        },
    });

    const math = lib({
        floor: fn(Math.floor), ceil: fn(Math.ceil), abs: fn(Math.abs), sqrt: fn(Math.sqrt),
        max: fn(Math.max), min: fn(Math.min), huge: Infinity, pi: Math.PI,
        random: fn((a, b) => {
            if (a === undefined) return Math.random();
            if (b === undefined) { b = a; a = 1; }
            return a + Math.floor(Math.random() * (b - a + 1));
        }),
        tointeger: fn((v) => (Number.isInteger(v) ? v : undefined)),
    });

    const os = lib({
        time: fn(() => Math.floor(Date.now() / 1000)),
        clock: fn(() => process.uptime()),
        date: fn(() => new Date().toISOString()),
    });

    G.set('_G', G);
    G.set('string', string);
    G.set('table', table);
    G.set('math', math);
    G.set('os', os);
    G.set('next', next);
    G.set('type', fn(luaType));
    G.set('tostring', fn(tostring));
    G.set('tonumber', fn(tonumber));
    G.set('rawget', fn((t, k) => t.rawget(k)));
    G.set('rawset', fn((t, k, v) => { t.set(k, v); return t; }));
    G.set('unpack', table.get('unpack'));
    G.set('select', (n, ...args) => (n === '#' ? [args.length] : args.slice(n < 0 ? args.length + n : n - 1)));
    G.set('print', (...args) => { output.push(args.map(tostring).join('\t')); return []; });
    G.set('error', (v) => { throw new LuaError(v); });
    G.set('assert', (v, msg, ...rest) => { if (!truthy(v)) throw new LuaError(msg === undefined ? 'assertion failed!' : msg); return [v, msg, ...rest]; });
    G.set('pcall', (f, ...args) => {
        try {
            if (typeof f !== 'function') throw new LuaError('attempt to call a ' + luaType(f) + ' value');
            return [true, ...f(...args)];
        } catch (e) {
            if (e instanceof LuaError) return [false, e.value];
            if (e && e.__luaControl) throw e;
            return [false, String(e && e.message || e)];
        }
    });
    G.set('setmetatable', (t, mt) => { t.metatable = mt || null; return [t]; });
    G.set('getmetatable', (t) => [t instanceof LuaTable ? t.metatable || undefined : undefined]);
    G.set('pairs', (t) => {
        if (!(t instanceof LuaTable)) throw new LuaError(`bad argument #1 to 'for iterator' (table expected, got ${luaType(t)})`);
        const keys = [...t.hash.keys()];
        let i = 0;
        return [() => {
            while (i < keys.length) {
                const k = keys[i++];
                if (t.hash.has(k)) return [k, t.hash.get(k)];
            }
            return [undefined];
        }, t, undefined];
    });
    G.set('ipairs', (t) => {
        if (!(t instanceof LuaTable)) throw new LuaError(`bad argument #1 to 'ipairs' (table expected, got ${luaType(t)})`);
        let i = 0;
        return [() => { i++; const v = t.get(i); return v === undefined ? [undefined] : [i, v]; }, t, 0];
    });
    return { string };
}

// ── Interpreter ───────────────────────────────────────────────────────
class Scope {
    constructor(parent) { this.vars = new Map(); this.parent = parent; }
    lookup(name) {
        for (let s = this; s; s = s.parent) if (s.vars.has(name)) return s;
        return null;
    }
}

const BREAK = { __luaControl: 'break' };

class LuaVM {
    constructor() {
        this.G = new LuaTable();
        this.output = [];
        const { string } = createStdlib(this.G, this.output);
        this.stringLib = string;
    }

    setGlobal(name, value) { this.G.set(name, value); }
    getGlobal(name) { return this.G.get(name); }

    run(source, chunkName = 'chunk') {
        let ast;
        try {
            ast = luaparse.parse(source, { luaVersion: '5.3', encodingMode: 'pseudo-latin1', scope: false, locations: true });
        } catch (e) {
            throw new Error(`${chunkName}: parse error ${e.message}`);
        }
        this.chunkName = chunkName;
        const scope = new Scope(null);
        const r = this.execBlock(ast.body, scope, []);
        return r && r.ret ? r.ret : [];
    }

    str(node) {
        // luaparse pseudo-latin1 encodes each UTF-8 byte as a latin1 char.
        return Buffer.from(node.value, 'latin1').toString('utf8');
    }

    where(node) {
        return node && node.loc ? `${this.chunkName}:${node.loc.start.line}` : this.chunkName;
    }

    fail(node, message) {
        throw new LuaError(`${this.where(node)}: ${message}`);
    }

    execBlock(body, scope, varargs) {
        for (const stmt of body) {
            const r = this.exec(stmt, scope, varargs);
            if (r) return r;
        }
        return null;
    }

    assign(target, value, scope, varargs) {
        if (target.type === 'Identifier') {
            const s = scope.lookup(target.name);
            if (s) s.vars.set(target.name, value); else this.G.set(target.name, value);
        } else if (target.type === 'MemberExpression') {
            const base = this.eval(target.base, scope, varargs);
            if (!(base instanceof LuaTable)) this.fail(target, `attempt to index a ${luaType(base)} value (field '${target.identifier.name}')`);
            base.set(target.identifier.name, value);
        } else if (target.type === 'IndexExpression') {
            const base = this.eval(target.base, scope, varargs);
            if (!(base instanceof LuaTable)) this.fail(target, `attempt to index a ${luaType(base)} value`);
            base.set(this.eval(target.index, scope, varargs), value);
        } else this.fail(target, `unsupported assignment target ${target.type}`);
    }

    exec(node, scope, varargs) {
        switch (node.type) {
            case 'LocalStatement': {
                const values = this.evalList(node.init, scope, varargs);
                node.variables.forEach((v, i) => scope.vars.set(v.name, values[i]));
                return null;
            }
            case 'AssignmentStatement': {
                const values = this.evalList(node.init, scope, varargs);
                node.variables.forEach((v, i) => this.assign(v, values[i], scope, varargs));
                return null;
            }
            case 'CallStatement': this.evalCall(node.expression, scope, varargs); return null;
            case 'FunctionDeclaration': {
                const f = this.makeFunction(node, scope);
                if (node.isLocal) { scope.vars.set(node.identifier.name, undefined); scope.vars.set(node.identifier.name, this.makeFunction(node, scope)); }
                else if (node.identifier.type === 'MemberExpression' && node.identifier.indexer === ':') {
                    const base = this.eval(node.identifier.base, scope, varargs);
                    base.set(node.identifier.identifier.name, this.makeFunction(node, scope, true));
                } else this.assign(node.identifier, f, scope, varargs);
                return null;
            }
            case 'ReturnStatement': return { ret: this.evalList(node.arguments, scope, varargs) };
            case 'IfStatement': {
                for (const clause of node.clauses) {
                    if (clause.type === 'ElseClause' || truthy(this.eval(clause.condition, scope, varargs))) {
                        return this.execBlock(clause.body, new Scope(scope), varargs);
                    }
                }
                return null;
            }
            case 'WhileStatement': {
                while (truthy(this.eval(node.condition, scope, varargs))) {
                    const r = this.execBlock(node.body, new Scope(scope), varargs);
                    if (r === BREAK) break;
                    if (r) return r;
                }
                return null;
            }
            case 'RepeatStatement': {
                for (;;) {
                    const inner = new Scope(scope);
                    const r = this.execBlock(node.body, inner, varargs);
                    if (r === BREAK) break;
                    if (r) return r;
                    if (truthy(this.eval(node.condition, inner, varargs))) break;
                }
                return null;
            }
            case 'DoStatement': return this.execBlock(node.body, new Scope(scope), varargs);
            case 'BreakStatement': return BREAK;
            case 'ForNumericStatement': {
                const start = tonumber(this.eval(node.start, scope, varargs));
                const end = tonumber(this.eval(node.end, scope, varargs));
                const step = node.step ? tonumber(this.eval(node.step, scope, varargs)) : 1;
                for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
                    const inner = new Scope(scope);
                    inner.vars.set(node.variable.name, i);
                    const r = this.execBlock(node.body, inner, varargs);
                    if (r === BREAK) break;
                    if (r) return r;
                }
                return null;
            }
            case 'ForGenericStatement': {
                const [f, s, init] = this.evalList(node.iterators, scope, varargs);
                let control = init;
                for (;;) {
                    if (typeof f !== 'function') this.fail(node, 'attempt to call a non-function iterator');
                    const vals = f(s, control);
                    if (vals[0] === undefined || vals[0] === null) break;
                    control = vals[0];
                    const inner = new Scope(scope);
                    node.variables.forEach((v, i) => inner.vars.set(v.name, vals[i]));
                    const r = this.execBlock(node.body, inner, varargs);
                    if (r === BREAK) break;
                    if (r) return r;
                }
                return null;
            }
            default: this.fail(node, `unsupported statement ${node.type}`);
        }
        return null;
    }

    makeFunction(node, scope, method = false) {
        const vm = this;
        const params = node.parameters.map((p) => (p.type === 'VarargLiteral' ? '...' : p.name));
        if (method) params.unshift('self');
        return function luaFunction(...args) {
            const inner = new Scope(scope);
            let va = [];
            params.forEach((p, i) => {
                if (p === '...') va = args.slice(i);
                else inner.vars.set(p, args[i]);
            });
            const r = vm.execBlock(node.body, inner, va);
            if (r === BREAK) return [];
            return r && r.ret ? r.ret : [];
        };
    }

    evalList(nodes, scope, varargs) {
        const out = [];
        nodes.forEach((n, i) => {
            if (i === nodes.length - 1) out.push(...this.evalMulti(n, scope, varargs));
            else out.push(this.eval(n, scope, varargs));
        });
        return out;
    }

    evalMulti(node, scope, varargs) {
        if (node.type === 'CallExpression' || node.type === 'StringCallExpression' || node.type === 'TableCallExpression') {
            return this.evalCall(node, scope, varargs);
        }
        if (node.type === 'VarargLiteral') return varargs.slice();
        return [this.eval(node, scope, varargs)];
    }

    evalCall(node, scope, varargs) {
        let fnValue; let args;
        const argNodes = node.type === 'StringCallExpression' ? [node.argument]
            : node.type === 'TableCallExpression' ? [node.arguments] : node.arguments;
        if (node.base.type === 'MemberExpression' && node.base.indexer === ':') {
            const self = this.eval(node.base.base, scope, varargs);
            const name = node.base.identifier.name;
            if (typeof self === 'string') fnValue = this.stringLib.get(name);
            else if (self instanceof LuaTable) fnValue = self.get(name);
            else this.fail(node, `attempt to index a ${luaType(self)} value (method '${name}')`);
            args = [self, ...this.evalList(argNodes, scope, varargs)];
            if (typeof fnValue !== 'function') this.fail(node, `attempt to call a ${luaType(fnValue)} value (method '${name}')`);
        } else {
            fnValue = this.eval(node.base, scope, varargs);
            args = this.evalList(argNodes, scope, varargs);
            const callMeta = fnValue instanceof LuaTable && fnValue.metatable && fnValue.metatable.get('__call');
            if (typeof callMeta === 'function') {
                const target = fnValue;
                fnValue = (...a) => callMeta(target, ...a);
            }
            if (typeof fnValue !== 'function') {
                const label = node.base.type === 'Identifier' ? ` (global '${node.base.name}')`
                    : node.base.type === 'MemberExpression' ? ` (field '${node.base.identifier.name}')` : '';
                this.fail(node, `attempt to call a ${luaType(fnValue)} value${label}`);
            }
        }
        const r = fnValue(...args);
        return Array.isArray(r) ? r : [r];
    }

    index(node, base, key) {
        if (typeof base === 'string') return this.stringLib.get(key);
        if (!(base instanceof LuaTable)) this.fail(node, `attempt to index a ${luaType(base)} value (key '${tostring(key)}')`);
        return base.get(key);
    }

    arith(node, op, a, b) {
        const na = typeof a === 'number' ? a : tonumber(a);
        const nb = typeof b === 'number' ? b : tonumber(b);
        if (na === undefined || nb === undefined) this.fail(node, `attempt to perform arithmetic on a ${luaType(na === undefined ? a : b)} value`);
        switch (op) {
            case '+': return na + nb;
            case '-': return na - nb;
            case '*': return na * nb;
            case '/': return na / nb;
            case '//': return Math.floor(na / nb);
            case '%': return na - Math.floor(na / nb) * nb;
            case '^': return Math.pow(na, nb);
            default: return this.fail(node, `unsupported operator ${op}`);
        }
    }

    compare(node, op, a, b) {
        if (op === '==') return a === b;
        if (op === '~=') return a !== b;
        const okTypes = (typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string');
        if (!okTypes) this.fail(node, `attempt to compare ${luaType(a)} with ${luaType(b)}`);
        switch (op) {
            case '<': return a < b;
            case '>': return a > b;
            case '<=': return a <= b;
            case '>=': return a >= b;
            default: return this.fail(node, `unsupported comparison ${op}`);
        }
    }

    eval(node, scope, varargs) {
        switch (node.type) {
            case 'NilLiteral': return undefined;
            case 'BooleanLiteral': return node.value;
            case 'NumericLiteral': return node.value;
            case 'StringLiteral': return this.str(node);
            case 'VarargLiteral': return varargs[0];
            case 'Identifier': {
                const s = scope.lookup(node.name);
                return s ? s.vars.get(node.name) : this.G.get(node.name);
            }
            case 'MemberExpression': return this.index(node, this.eval(node.base, scope, varargs), node.identifier.name);
            case 'IndexExpression': return this.index(node, this.eval(node.base, scope, varargs), this.eval(node.index, scope, varargs));
            case 'CallExpression': case 'StringCallExpression': case 'TableCallExpression':
                return this.evalCall(node, scope, varargs)[0];
            case 'FunctionDeclaration': return this.makeFunction(node, scope);
            case 'TableConstructorExpression': {
                const t = new LuaTable();
                let n = 1;
                node.fields.forEach((f, i) => {
                    if (f.type === 'TableKeyString') t.set(f.key.name, this.eval(f.value, scope, varargs));
                    else if (f.type === 'TableKey') t.set(this.eval(f.key, scope, varargs), this.eval(f.value, scope, varargs));
                    else if (i === node.fields.length - 1) {
                        for (const v of this.evalMulti(f.value, scope, varargs)) t.set(n++, v);
                    } else t.set(n++, this.eval(f.value, scope, varargs));
                });
                return t;
            }
            case 'LogicalExpression': {
                const left = this.eval(node.left, scope, varargs);
                if (node.operator === 'and') return truthy(left) ? this.eval(node.right, scope, varargs) : left;
                return truthy(left) ? left : this.eval(node.right, scope, varargs);
            }
            case 'UnaryExpression': {
                const v = this.eval(node.argument, scope, varargs);
                if (node.operator === 'not') return !truthy(v);
                if (node.operator === '-') return -this.arith(node, '+', 0, v);
                if (node.operator === '#') {
                    if (typeof v === 'string') return Buffer.byteLength(v, 'utf8');
                    if (v instanceof LuaTable) return v.length();
                    this.fail(node, `attempt to get length of a ${luaType(v)} value`);
                }
                return this.fail(node, `unsupported unary ${node.operator}`);
            }
            case 'BinaryExpression': {
                const a = this.eval(node.left, scope, varargs);
                const b = this.eval(node.right, scope, varargs);
                const op = node.operator;
                if (op === '..') {
                    const ok = (v) => typeof v === 'string' || typeof v === 'number';
                    if (!ok(a) || !ok(b)) this.fail(node, `attempt to concatenate a ${luaType(ok(a) ? b : a)} value`);
                    return tostring(a) + tostring(b);
                }
                if (['==', '~=', '<', '>', '<=', '>='].includes(op)) return this.compare(node, op, a, b);
                return this.arith(node, op, a, b);
            }
            default: return this.fail(node, `unsupported expression ${node.type}`);
        }
    }
}

// ── JS ⇄ Lua helpers for tests ────────────────────────────────────────
function toLua(value) {
    if (value === null || value === undefined) return undefined;
    if (value instanceof LuaTable) return value;
    if (typeof value === 'function') return value;
    if (Array.isArray(value)) { const t = new LuaTable(); value.forEach((v, i) => t.set(i + 1, toLua(v))); return t; }
    if (typeof value === 'object') { const t = new LuaTable(); for (const [k, v] of Object.entries(value)) t.set(k, toLua(v)); return t; }
    return value;
}

function toJs(value) {
    if (!(value instanceof LuaTable)) return value;
    const n = value.length();
    if (n > 0 && n === value.hash.size) { const out = []; for (let i = 1; i <= n; i++) out.push(toJs(value.get(i))); return out; }
    const out = {};
    for (const [k, v] of value.hash) out[k] = toJs(v);
    return out;
}

// Marks a JS array as multiple Lua return values (instead of one table).
function multi(...values) { return Object.assign(values, { __multi: true }); }

// Wraps a JS function as a Lua function; return multi(a, b) for several values.
function luaFn(f) {
    return (...args) => { const r = f(...args); return r && r.__multi ? r.map(toLua) : [toLua(r)]; };
}

module.exports = { LuaVM, LuaTable, LuaError, toLua, toJs, luaFn, multi, patternToRegex };
