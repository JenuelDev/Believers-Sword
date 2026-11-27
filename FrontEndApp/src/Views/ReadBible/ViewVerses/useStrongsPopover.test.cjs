const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {ref}=require('vue');

function fixture() {
    const original={window:global.window,Element:global.Element};
    const hooks=[];
    const module={exports:{}};
    const source=fs.readFileSync(path.join(__dirname,'useStrongsPopover.ts'),'utf8');
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',compiled)(()=>({ref,onUnmounted:fn=>hooks.push(fn)}),module,module.exports);
    class Word {
        constructor(number){this.dataset={strong:String(number)};this.isConnected=true;}
        closest(selector){return selector==='.strongs-word'?this:null;}
        getBoundingClientRect(){return {left:10,width:60,top:100,bottom:120};}
    }
    const win=new EventTarget();
    const calls=[];
    let lookup=async key=>({strong_number:key});
    let collapsed=true;
    let enabled=true;
    win.innerHeight=800;
    win.getSelection=()=>({isCollapsed:collapsed});
    win.browserWindow={getStrongsDefinition:key=>{calls.push(key);return lookup(key);}};
    global.window=win;
    global.Element=Word;
    const reader=module.exports.useStrongsPopover(()=>enabled);
    const word=new Word(3326);
    function event(type,target=word,extra={}) {
        const e=new Event(type,{cancelable:true});
        Object.defineProperty(e,'target',{value:target});
        Object.assign(e,{button:0,detail:1,clientX:10,clientY:10,...extra});
        return e;
    }
    return {reader,word,calls,win,Word,event,
        down(extra={},target=word,book=490){const e=event('mousedown',target,extra);reader.handleStrongsMouseDown(e,{book_number:book});return e;},
        move(extra={}){win.dispatchEvent(event('mousemove',word,extra));},
        up(extra={},target=word){win.dispatchEvent(event('mouseup',target,extra));},
        click(extra={},target=word){reader.handleStrongsClick(event('click',target,extra));},
        select(){collapsed=false;}, disable(){enabled=false;}, setLookup(fn){lookup=fn;},
        unmount(){hooks.splice(0).forEach(fn=>fn());},
        close(){hooks.splice(0).forEach(fn=>fn());global.window=original.window;global.Element=original.Element;},
    };
}

test('a press preserves native selection and only a completed click opens or toggles',async()=>{
    const f=fixture();try{
        const down=f.down();assert.equal(down.defaultPrevented,false);assert.equal(down.cancelBubble,true);
        assert.equal(f.calls.length,0);f.up();assert.equal(f.calls.length,0);f.click();
        assert.deepEqual(f.calls,['G3326']);await Promise.resolve();assert.equal(f.reader.strongsPopover.value.show,true);
        f.down();f.up();f.click();assert.equal(f.reader.strongsPopover.value.show,false);
        const other=new f.Word(430);f.down({},other,10);f.up({},other);f.click({},other);
        assert.equal(f.calls.at(-1),'H430');
    }finally{f.close();}
});

test('dragging out and back never opens the popup, even with a collapsed range',()=>{
    const f=fixture();try{
        f.down();f.up();f.click();assert.equal(f.reader.strongsPopover.value.show,true);
        f.down();f.move({clientX:60});f.move({clientX:10});f.up();f.click();
        assert.equal(f.calls.length,1);assert.equal(f.reader.strongsPopover.value.show,false);
    }finally{f.close();}
});

test('native ranges, double-clicks and releases on another word do not open definitions',()=>{
    const f=fixture();try{
        f.down();f.select();f.up();f.click();assert.equal(f.calls.length,0);
        f.down({detail:2});f.up({detail:2});f.click({detail:2});assert.equal(f.calls.length,0);
        f.down();f.up({},new f.Word(430));f.click();assert.equal(f.calls.length,0);
    }finally{f.close();}
});

test('modified clicks and non-left buttons reach the existing verse-selection handler',()=>{
    const f=fixture();try{
        for(const extra of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{button:1},{button:2}]){
            const down=f.down(extra);assert.equal(down.defaultPrevented,false);assert.equal(down.cancelBubble,false);
            f.up(extra);f.click(extra);
        }
        assert.equal(f.calls.length,0);
    }finally{f.close();}
});

test('blur, pointer cancellation, disabled settings and unmount cancel unfinished clicks',()=>{
    const f=fixture();try{
        for(const name of ['blur','pointercancel']){f.down();f.win.dispatchEvent(new Event(name));f.up();f.click();}
        f.down();f.disable();f.up();f.click();assert.equal(f.calls.length,0);
    }finally{f.close();}
    const g=fixture();try{g.down();g.unmount();g.up();g.click();assert.equal(g.calls.length,0);}finally{g.close();}
});

test('closing a pending lookup invalidates the async response',async()=>{
    const f=fixture();try{
        let finish;f.setLookup(()=>new Promise(resolve=>{finish=resolve;}));
        f.down();f.up();f.click();f.reader.closeStrongsPopover();
        finish({strong_number:'G3326'});await Promise.resolve();await Promise.resolve();
        assert.equal(f.reader.strongsPopover.value.show,false);assert.equal(f.reader.strongsPopover.value.entry,null);
    }finally{f.close();}
});
