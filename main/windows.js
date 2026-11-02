const path = require('node:path');
const { BrowserWindow, screen } = require('electron');
const { clampToDisplays } = require('./position');
const ROOT = path.join(__dirname,'..');
function baseWebPrefs() { return { preload: path.join(ROOT,'preload','preload.js'), contextIsolation:true, nodeIntegration:false, sandbox:true }; }
function displayRects() { const primary=screen.getPrimaryDisplay(); return [primary,...screen.getAllDisplays().filter(d=>d.id!==primary.id)].map(d=>d.workArea); }
function protect(win, requireFocus = true) {
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', e=>e.preventDefault());
  const activity = () => { if (!win.isDestroyed()) win.webContents.send('window:activity',win.isVisible()&&(!requireFocus||win.isFocused())); };
  ['focus','blur','show','hide','minimize','restore'].forEach(name=>win.on(name,activity));
  win.webContents.on('did-finish-load',()=>setTimeout(activity,0));
  return win;
}
function widgetSize(prefs) { return prefs.buddy === false ? {w:216,h:101} : {w:248,h:177}; }
function createWidget(store) {
  const size=widgetSize(store.get().prefs),pos=clampToDisplays(store.get().prefs.widgetPos,size,displayRects());
  const win=protect(new BrowserWindow({x:pos.x,y:pos.y,width:size.w,height:size.h,frame:false,resizable:false,skipTaskbar:true,alwaysOnTop:store.get().prefs.alwaysOnTop,show:false,webPreferences:baseWebPrefs()}),false);
  win.loadFile(path.join(ROOT,'renderer','widget','index.html'));
  win.on('moved',()=>{if(win.isDestroyed())return;const[x,y]=win.getPosition();try{store.update(s=>{s.prefs.widgetPos={x,y};});}catch(e){console.error('保存窗口位置失败',e.message);}});
  return win;
}
function resizeWidget(win,prefs) {
  win.setAlwaysOnTop(prefs.alwaysOnTop);
  const size=widgetSize(prefs),bounds=win.getBounds();
  if(bounds.width===size.w&&bounds.height===size.h)return;
  const pos=clampToDisplays({x:bounds.x+bounds.width-size.w,y:bounds.y+bounds.height-size.h},size,displayRects());
  win.setBounds({x:pos.x,y:pos.y,width:size.w,height:size.h});
}
function createAppWindow(state) {
  const win=protect(new BrowserWindow({width:900,height:626,minWidth:720,minHeight:560,frame:false,show:false,backgroundColor:'#efefef',autoHideMenuBar:true,webPreferences:baseWebPrefs()}));
  win.loadFile(path.join(ROOT,'renderer','app','index.html'));
  win.on('close',e=>{if(!state.quitting){e.preventDefault();if(state.controller)state.controller.hideApp();else win.hide();}});
  return win;
}
function createReminderWindow(state,acknowledge) {
  const win=protect(new BrowserWindow({width:340,height:196,frame:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,show:false,webPreferences:baseWebPrefs()}));
  win.loadFile(path.join(ROOT,'renderer','reminder','index.html'));
  win.on('close',e=>{if(!state.quitting){e.preventDefault();acknowledge();}});
  return win;
}
function showAppWindow(win){if(win.isMinimized())win.restore();win.show();win.focus();}
module.exports={createWidget,createAppWindow,createReminderWindow,resizeWidget,showAppWindow,displayRects};
