export class SnapshotSync {
  constructor({load,write,cache,onStatus,validate}) {
    Object.assign(this,{load,write,cache,onStatus,validate});
    this.version=null;this.pending=null;this.busy=null;this.blocked=false;this.saved='';
  }
  async restore() {
    const row=await this.load();
    if(row){this.validate(row.payload);this.version=row.version;this.saved=JSON.stringify(row.payload);}
    return row?.payload??null;
  }
  mark(payload) {
    const text=JSON.stringify(payload);
    if(text===this.saved&&!this.pending)return;
    if(this.pending?.text===text)return;
    this.pending={payload:JSON.parse(text),text};
    this.cache(this.pending);
    this.onStatus(this.blocked?'conflict':'pending');
  }
  async flush() {
    if(this.busy)return this.busy;
    if(this.blocked||!this.pending)return;
    this.busy=(async()=>{
      this.onStatus('saving');
      try {
        while(this.pending&&!this.blocked){
          const next=this.pending;
          const row=await this.write(next.payload,this.version);
          if(!row){this.blocked=true;this.onStatus('conflict');return;}
          this.version=row.version;this.saved=next.text;
          if(this.pending===next)this.pending=null;
          this.cache(this.pending);
        }
        this.onStatus('saved');
      } catch(e){if(e.code==='23505'){this.blocked=true;this.onStatus('conflict');}else this.onStatus('error',e);}
    })();
    try{await this.busy;}finally{this.busy=null;}
  }
}
