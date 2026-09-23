/* 噜噜健康助手 · Service Worker（v14）
 *
 * 策略：
 *  - 应用外壳（HTML / manifest / 图标）预缓存，离线也能打开
 *  - 页面导航：network-first，拿到新版就刷新缓存；断网时回退缓存
 *  - 其他同源静态资源：cache-first
 *  - 边界：只处理同源 GET，第三方请求一律不碰（本应用本来也不外联）
 *
 * 注意：CACHE 名带版本号，每次发版必须改 —— 否则 activate 阶段不会清理旧缓存，
 * 用户会一直命中旧版 HTML（v8.0 → v8.1 就是因为没升号，用户手机上一直看到旧版）。
 */

var CACHE = 'lulu-bmi-v25';   // v11.2：拦截卡改隐藏不抹元素（风险降级可恢复）+ 修复 i-copy/i-pen/i-warn 引用
var ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-maskable.svg'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // 单个资源缺失不应让整个安装失败
      return Promise.all(ASSETS.map(function(u){
        return c.add(u).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){
        return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if(url.origin !== self.location.origin) return;

  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
        return res;
      }).catch(function(){
        return caches.match('./index.html').then(function(hit){
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
