/* =========================================================
   sync.js  校历同步桥
   与「Jocelyn Z.个人工作台」共享同一份校历（学年 / 学期 / 第1周周一 / 总周数）
   任意一侧修改，另一侧刷新后自动生效
   ========================================================= */
(function (TW) {
  'use strict';
  const KEY = 'jz:sharedCalendar';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function write(at) {
    try {
      const s = TW.S.settings;
      localStorage.setItem(KEY, JSON.stringify({
        schoolYear: s.schoolYear, termName: s.termName, termStart: s.termStart,
        totalWeeks: s.totalWeeks, teacherName: s.teacherName, at: at || Date.now()
      }));
      const t = TW.term.current();
      if (t) { t.schoolYear = s.schoolYear; t.termName = s.termName; t.termStart = s.termStart; t.totalWeeks = s.totalWeeks; }
    } catch (e) { }
  }

  const origLoad = TW.db.load;
  TW.db.load = async function () {
    const r = await origLoad.apply(this, arguments);
    const c = read();
    const s = TW.S.settings;
    if (c && (c.at || 0) > (s.calAt || 0)) {
      s.schoolYear = c.schoolYear || s.schoolYear;
      s.termName = c.termName || s.termName;
      s.termStart = c.termStart || s.termStart;
      s.totalWeeks = c.totalWeeks || s.totalWeeks;
      if (!s.teacherName && c.teacherName) s.teacherName = c.teacherName;
      s.calAt = c.at;
      const t = TW.term.current();
      if (t) { t.schoolYear = s.schoolYear; t.termName = s.termName; t.termStart = s.termStart; t.totalWeeks = s.totalWeeks; }
      TW.db.save('settings');
    } else if (!c) {
      s.calAt = Date.now(); write(s.calAt); TW.db.save('settings');
    }
    return r;
  };

  TW.db.on('settings:change', function () {
    const at = Date.now();
    TW.S.settings.calAt = at;
    write(at);
    TW.db.save('settings');
  });
})(window.TW);
