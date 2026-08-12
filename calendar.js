/* =========================================================
   calendar.js  校历引擎：教学周 / 课次生成 / 调课合成 / 进度链
   所有"第几周"统一以此处校历为准
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u, S = TW.S;

  /** 第1教学周的周一 */
  function week1Monday() {
    return u.mondayOf(TW.S.settings.termStart || u.ymd(new Date()));
  }

  /** 日期 -> 教学周次；不在学期内返回 0 */
  function weekOf(date) {
    const d = u.parseYmd(date); if (!d) return 0;
    const m0 = week1Monday();
    const w = Math.floor(u.diffDays(u.mondayOf(d), m0) / 7) + 1;
    if (w < 1) return 0;
    if (w > (TW.S.settings.totalWeeks || 20)) return 0;
    return w;
  }
  /** 原始周次（可越界，用于提示"学期外"） */
  function rawWeekOf(date) {
    const d = u.parseYmd(date); if (!d) return 0;
    return Math.floor(u.diffDays(u.mondayOf(d), week1Monday()) / 7) + 1;
  }
  /** 第 w 周第 dow(1-7) 天的日期字符串 */
  function dateOf(w, dow) {
    return u.ymd(u.addDays(week1Monday(), (w - 1) * 7 + (dow - 1)));
  }
  function termRange() {
    const a = week1Monday();
    const b = u.addDays(a, (TW.S.settings.totalWeeks || 20) * 7 - 1);
    return { start: u.ymd(a), end: u.ymd(b) };
  }
  function termLabel() {
    const s = TW.S.settings;
    return (s.schoolYear || '') + ' ' + (s.termName || '');
  }

  /** 课表条目在第 w 周是否有课 */
  function inWeek(item, w) {
    if (!w) return false;
    if (item.weekType === 'odd' && w % 2 === 0) return false;
    if (item.weekType === 'even' && w % 2 === 1) return false;
    if (Array.isArray(item.weeks) && item.weeks.length) return item.weeks.indexOf(w) >= 0;
    return true; // 未指定则全学期
  }

  function periodInfo(pid) {
    const p = TW.db.period(pid);
    return p || { id: pid, name: pid || '未设节次', start: '00:00', end: '00:00' };
  }

  /**
   * 某日的课次列表（已合成调课/停课/补课）
   * 返回 [{key,scheduleId,classId,course,room,periodId,pname,start,end,date,week,flag}]
   */
  function lessonsOn(date) {
    const ds = u.ymd(u.parseYmd(date));
    const w = weekOf(ds), dow = u.isoDow(ds);
    const adj = (TW.term ? TW.term.adjustItems() : (TW.S.adjustments || []));
    const out = [];

    // 基础课表（仅当前学期）
    (TW.term ? TW.term.scheduleItems() : (TW.S.schedule || [])).forEach(it => {
      if (it.dow !== dow) return;
      if (!inWeek(it, w)) return;
      const moved = adj.find(a => a.scheduleId === it.id && a.fromDate === ds && (a.type === 'move' || a.type === 'cancel'));
      if (moved) return; // 当天被调走或停课
      out.push(mk(it, ds, it.periodId, ''));
    });

    // 调入本日
    adj.filter(a => a.type === 'move' && a.toDate === ds).forEach(a => {
      const it = (TW.S.schedule || []).find(x => x.id === a.scheduleId);
      if (!it) return;
      out.push(mk(it, ds, a.toPeriodId || it.periodId, 'move', a));
    });
    // 补课
    adj.filter(a => a.type === 'extra' && a.toDate === ds).forEach(a => {
      out.push({
        key: ds + '__' + a.id, scheduleId: a.id, classId: a.classId, course: a.course || '补课',
        room: a.room || '', periodId: a.toPeriodId, pname: periodInfo(a.toPeriodId).name,
        start: periodInfo(a.toPeriodId).start, end: periodInfo(a.toPeriodId).end,
        date: ds, week: w, flag: 'extra', adj: a
      });
    });

    function mk(it, d, pid, flag, a) {
      const p = periodInfo(pid);
      return {
        key: d + '__' + it.id, scheduleId: it.id, classId: it.classId, course: it.course,
        room: it.room || '', periodId: pid, pname: p.name, start: p.start, end: p.end,
        date: d, week: weekOf(d), flag: flag || '', adj: a || null
      };
    }

    out.sort((x, y) => u.hm2min(x.start) - u.hm2min(y.start));
    return out;
  }

  /** 全学期所有课次（按时间升序），可按班级过滤 */
  function allOccurrences(filter) {
    const r = termRange();
    const res = [];
    let d = u.parseYmd(r.start), end = u.parseYmd(r.end);
    while (d <= end) {
      const ds = u.ymd(d);
      lessonsOn(ds).forEach(o => {
        if (filter) {
          if (filter.classId && o.classId !== filter.classId) return;
          if (filter.course && o.course !== filter.course) return;
          if (filter.scheduleId && o.scheduleId !== filter.scheduleId) return;
        }
        res.push(o);
      });
      d = u.addDays(d, 1);
    }
    res.sort((a, b) => a.date === b.date ? u.hm2min(a.start) - u.hm2min(b.start) : (a.date < b.date ? -1 : 1));
    return res;
  }

  /** 某班某课程的课次序列（用于进度链） */
  function chainOf(classId, course) {
    return allOccurrences({ classId: classId, course: course });
  }

  /**
   * 课前进度：取同班同课程上一次课的"课后进度"
   * 若上一次课未填课后进度，继续向前追溯
   */
  function inheritedPre(occ) {
    const chain = chainOf(occ.classId, occ.course);
    const idx = chain.findIndex(x => x.date === occ.date && x.scheduleId === occ.scheduleId);
    if (idx <= 0) return '';
    for (let i = idx - 1; i >= 0; i--) {
      const l = TW.db.getLesson(chain[i].date, chain[i].scheduleId);
      if (l && l.post && l.post.trim()) return l.post.trim();
    }
    return '';
  }

  /** 课次显示用的完整进度（自动继承 + 手工覆盖） */
  function progressOf(occ) {
    const l = TW.db.getLesson(occ.date, occ.scheduleId) || {};
    const pre = (l.preManual && l.pre) ? l.pre : inheritedPre(occ);
    return { pre: pre, content: l.content || '', post: l.post || '', note: l.note || '', homework: l.homework || '', status: l.status || '', preManual: !!l.preManual };
  }

  /** 某班本学期所有上课日期（去重升序） */
  function classDates(classId) {
    const set = [];
    allOccurrences({ classId: classId }).forEach(o => { if (set.indexOf(o.date) < 0) set.push(o.date); });
    return set;
  }

  /** 到今天为止已上课日期 */
  function classDatesUntilToday(classId) {
    const t = u.ymd(u.today());
    return classDates(classId).filter(d => d <= t);
  }

  /** 学期进度百分比 */
  function termProgress() {
    const r = termRange();
    const total = u.diffDays(r.end, r.start) + 1;
    const passed = Math.min(total, Math.max(0, u.diffDays(u.today(), r.start) + 1));
    return { total: total, passed: passed, pct: Math.round(passed / total * 100) };
  }

  /** 当前正在上/下一节课 */
  function currentLesson(list) {
    const now = u.hm2min(u.nowHm());
    let cur = null, next = null;
    (list || lessonsOn(u.today())).forEach(o => {
      const s = u.hm2min(o.start), e = u.hm2min(o.end);
      if (now >= s && now <= e) cur = o;
      else if (now < s && !next) next = o;
    });
    return { current: cur, next: next };
  }

  TW.cal = {
    week1Monday: week1Monday, weekOf: weekOf, rawWeekOf: rawWeekOf, dateOf: dateOf,
    termRange: termRange, termLabel: termLabel, inWeek: inWeek, periodInfo: periodInfo,
    lessonsOn: lessonsOn, allOccurrences: allOccurrences, chainOf: chainOf,
    inheritedPre: inheritedPre, progressOf: progressOf,
    classDates: classDates, classDatesUntilToday: classDatesUntilToday,
    termProgress: termProgress, currentLesson: currentLesson
  };
})(window.TW);
