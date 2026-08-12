/* 云端配置：仅含项目基址与 publishable(anon) key，两者均可安全嵌入前端 */
(function (root) {
  'use strict';
  const JZ = (root.JZ = root.JZ || {});
  JZ.cloudConfig = {
    url: 'https://wgmvcihxkhnhcoptboix.supabase.co',
    anonKey: 'sb_publishable_YFyAigKOmkp8wggRTgjreA_fqWJ91io'
  };
})(typeof window !== 'undefined' ? window : globalThis);
