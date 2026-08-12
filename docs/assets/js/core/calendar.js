/* =========================================================
   calendar.js  校历引擎
   全站所有「第几周」统一以此为准，并与教学工作台共享同一份校历
   ========================================================= */
(function (JZ) {
  'use strict';
  const u = JZ.u;

  function st() { return JZ.S.settings; }

  /** 第1教学周的周一 */
  function week1Monday() { return u.mondayOf(st().termStart || u.ymd(new Date())); }

  /** 日期 -> 教学周次，学期外返回0 */
  function weekOf(date) {
    const d = u.parseYmd(date); if (!d) return 0;
    const w = Math.floor(u.diffDays(u.mondayOf(d), week1Monday()) / 7) + 1;
    if (w < 1 || w > (st().totalWeeks || 20)) return 0;
    return w;
  }
  /** 原始周次，可越界 */
  function rawWeekOf(date) {
    const d = u.parseYmd(date); if (!d) return 0;
    return Math.floor(u.diffDays(u.mondayOf(d), week1Monday()) / 7) + 1;
  }
  /** 第w周第dow(1-7)天 */
  function dateOf(w, dow) { return u.ymd(u.addDays(week1Monday(), (w - 1) * 7 + (dow - 1))); }
  /** 第w周的起止 */
  function weekRange(w) { return { start: dateOf(w, 1), end: dateOf(w, 7) }; }
  function termRange() {
    const a = week1Monday();
    return { start: u.ymd(a), end: u.ymd(u.addDays(a, (st().totalWeeks || 20) * 7 - 1)) };
  }
  function termLabel() { return (st().schoolYear || '') + ' ' + (st().termName || ''); }
  /** 顶栏用的周次文案 */
  function weekText(date) {
    const w = weekOf(date || u.today()), raw = rawWeekOf(date || u.today());
    if (w) return '第' + w + '周 / 共' + (st().totalWeeks || 20) + '周';
    return raw < 1 ? '开学前 ' + Math.abs(raw) * 7 + '天内' : '学期已结束';
  }
  function termProgress() {
    const r = termRange();
    const total = u.diffDays(r.end, r.start) + 1;
    const passed = Math.min(total, Math.max(0, u.diffDays(u.today(), r.start) + 1));
    return { total: total, passed: passed, pct: Math.round(passed / total * 100) };
  }
  /** 月历网格：返回 6*7 的日期数组 */
  function monthGrid(y, m) {
    const first = new Date(y, m - 1, 1);
    const start = u.mondayOf(first);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = u.addDays(start, i);
      cells.push({ date: u.ymd(d), day: d.getDate(), inMonth: d.getMonth() === m - 1, week: weekOf(d), dow: u.isoDow(d) });
    }
    return cells;
  }
  /** 本学期所有周次列表 */
  function weeks() {
    const n = st().totalWeeks || 20, out = [];
    for (let i = 1; i <= n; i++) out.push({ w: i, start: dateOf(i, 1), end: dateOf(i, 7) });
    return out;
  }
  /** 距离某日期的天数描述 */
  function dueText(date) {
    if (!date) return '';
    const n = u.diffDays(date, u.today());
    if (n === 0) return '今天到期';
    if (n === 1) return '明天到期';
    if (n > 1) return '还有' + n + '天';
    return '已逾期' + Math.abs(n) + '天';
  }

  JZ.cal = {
    week1Monday, weekOf, rawWeekOf, dateOf, weekRange, termRange, termLabel,
    weekText, termProgress, monthGrid, weeks, dueText
  };
})(window.JZ);
