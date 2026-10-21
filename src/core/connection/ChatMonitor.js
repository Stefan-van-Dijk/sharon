export function chatRefreshDelay(idleMs) {
  return idleMs < 60000 ? 5000 : idleMs < 300000 ? 15000 : 30000;
}

// One foreground scheduler per installation window, shared by Shell and People.
export class ChatMonitor {
  constructor(service,{clock=()=>Date.now(),documentObject=document,setTimer=(...args)=>globalThis.setInterval(...args),clearTimer=id=>globalThis.clearInterval(id)}={}) {
    Object.assign(this,{service,clock,document:documentObject,setTimer,clearTimer});
    this.state={contacts:[],total:0,error:''};this.listeners=new Set();
    this.active=null;this.timer=null;this.flight=null;this.started=false;
    this.nextInbox=this.clock()+60000;this.nextChat=Infinity;this.activityAt=this.clock();
    this.visibility=()=>{
      if(this.document.hidden){this.pause();return;}
      if(!this.started)return;
      this.nextInbox=this.clock();this.nextChat=this.clock();this.resume();this.tick().catch(error=>this.report(error));
    };
  }
  subscribe(listener){this.listeners.add(listener);listener(this.state);return()=>this.listeners.delete(listener);}
  async refreshUnread(contacts=null) {
    const unread=await this.service.unreadState(contacts);
    this.state={...unread,error:this.state.error};
    for(const listener of this.listeners)listener(this.state);
    return this.state;
  }
  report(error='') {
    this.state={...this.state,error:error?.message||String(error||'')};
    for(const listener of this.listeners)listener(this.state);
  }
  start(){
    if(this.started)return;this.started=true;
    this.document.addEventListener('visibilitychange',this.visibility);
    this.refreshUnread().catch(()=>{});this.resume();
  }
  resume(){if(this.started&&!this.document.hidden&&this.timer===null)this.timer=this.setTimer(()=>{this.tick().catch(error=>this.report(error));},1000);}
  pause(){if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
  stop(){this.started=false;this.pause();this.active=null;this.document.removeEventListener('visibilitychange',this.visibility);}
  watchChat(chatId,handlers){
    const active={chatId,...handlers};this.active=active;this.activityAt=this.clock();this.nextChat=this.clock()+5000;
    return()=>{if(this.active===active){this.active=null;this.nextChat=Infinity;this.nextInbox=Math.min(this.nextInbox,this.clock()+60000);}};
  }
  activity(){this.activityAt=this.clock();this.nextChat=Math.min(this.nextChat,this.clock()+5000);}
  queue(task){
    const next=(this.flight||Promise.resolve()).catch(()=>{}).then(task);this.flight=next;
    return next.finally(()=>{if(this.flight===next)this.flight=null;});
  }
  async show(active,messages) {
    if(this.active!==active||this.document.hidden)return;
    active.onMessages(messages);
    await this.service.markRead(active.chatId,messages);
    await this.refreshUnread();
  }
  async syncActive(active) {
    if(!active||this.active!==active||this.document.hidden)return;
    try {
      const before=await this.service.cachedMessages(active.chatId);
      const messages=await this.service.sync(active.chatId);
      if(this.active!==active||this.document.hidden)return;
      const seen=new Set(before.filter(m=>m.delivery==='sent').map(m=>m.id));
      if(messages.some(m=>m.delivery==='sent'&&!seen.has(m.id)))this.activityAt=this.clock();
      await this.show(active,messages);this.report('');active.onError?.('');
    } catch(error) {
      if(this.active===active&&!this.document.hidden){this.report(error);active.onError?.(error.message);}
    } finally {this.nextChat=this.clock()+chatRefreshDelay(this.clock()-this.activityAt);}
  }
  resetNetwork(){return this.queue(async()=>{
    this.active=null;this.nextChat=Infinity;await this.service.resetNetwork();
    this.nextInbox=this.clock()+60000;await this.refreshUnread([]);this.report('');
  });}
  refreshActive(){const active=this.active;return this.queue(()=>this.syncActive(active));}
  async tick(){
    if(!this.started||this.document.hidden||this.flight)return;
    const inboxDue=this.clock()>=this.nextInbox,chatDue=this.active&&this.clock()>=this.nextChat;
    if(!inboxDue&&!chatDue)return;
    if(inboxDue)this.nextInbox=this.clock()+60000;
    const active=this.active;
    return this.queue(async()=>{
      if(!this.started||this.document.hidden)return;
      const device=await this.service.device();
      if(!device.registered||!Number.isInteger(device.self?.line)){await this.refreshUnread([]);this.report('');return;}
      if(inboxDue){
        try {
          const contacts=await this.service.contacts();
          for(const contact of contacts){
            if(!this.started||this.document.hidden)break;
            if(contact.chatId===this.active?.chatId)continue;
            await this.service.sync(contact.chatId);
          }
          if(!this.document.hidden){await this.refreshUnread(contacts);this.report('');}
        }catch(error){if(!this.document.hidden)this.report(error);}
      }
      if(chatDue||inboxDue)await this.syncActive(active);
    });
  }
}
