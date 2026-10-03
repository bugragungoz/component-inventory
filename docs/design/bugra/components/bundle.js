/* @ds-bundle: {"format":4,"namespace":"Bugra","components":[{"name":"SkipLink"},{"name":"Wordmark"},{"name":"Masthead"},{"name":"NavLink"},{"name":"IconButton"},{"name":"LanguageMenu"},{"name":"Button"},{"name":"CopyButton"},{"name":"PromoBar"},{"name":"Hero"},{"name":"Section"},{"name":"Steps"},{"name":"CodeBlock"},{"name":"Note"},{"name":"Footer"},{"name":"Chip"},{"name":"TextField"},{"name":"Switch"},{"name":"Dialog"},{"name":"Snackbar"},{"name":"SocialCard"}]} */
(function(){
var R=window.React,h=R.createElement;
function cx(){return Array.prototype.filter.call(arguments,Boolean).join(" ");}
function icon(paths,o){o=o||{};return h("svg",{viewBox:"0 0 24 24",fill:o.fill||"none",stroke:o.fill?undefined:"currentColor",strokeWidth:o.w||1.6,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",className:o.cls},paths.map(function(d,i){return h("path",{key:i,d:d});}));}
var GLOBE=["M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0","M3 12h18","M12 3c2.5 2.6 2.5 15 0 18","M12 3c-2.5 2.6-2.5 15 0 18"];
var CARET=["M6 9l6 6 6-6"];
var CLOSE=["M6 6l12 12M18 6L6 18"];
function omit(p,keys){var q=Object.assign({},p);keys.forEach(function(k){delete q[k];});return q;}

function SkipLink(p){return h("a",{className:cx("bg-skip",p.className),href:p.href||"#main"},p.children||"Skip to content");}

function Wordmark(p){p=p||{};return h(p.href?"a":"span",{className:cx("bg-wordmark",p.className),href:p.href},p.mark===false?null:h("span",{className:"bg-wordmark-mark","aria-hidden":"true"}),h("span",null,p.name||"bugra"));}

function Masthead(p){return h("header",{className:cx("bg-masthead",p.className)},h("div",{className:"bg-shell bg-masthead-inner"},p.wordmark||h(Wordmark,null),h("nav",{"aria-label":p.navLabel||"Links"},p.children)));}

function NavLink(p){return h("a",Object.assign({},omit(p,["className"]),{className:cx("bg-nav-text",p.className)}));}

function IconButton(p){var q=omit(p,["label","size","className","children"]);var tag=q.href?"a":"button";if(tag==="button"&&!q.type)q.type="button";q["aria-label"]=p.label;q.className=cx("bg-iconbtn",p.size==="sm"&&"bg-iconbtn-sm",p.className);return h(tag,q,p.children);}

function LanguageMenu(p){var ref=R.useRef(null);
R.useEffect(function(){var m=ref.current;if(!m)return;
function c(e){if(m.open&&!m.contains(e.target))m.open=false;}
function k(e){if(e.key==="Escape"&&m.open){m.open=false;m.querySelector("summary").focus();}}
document.addEventListener("click",c);document.addEventListener("keydown",k);
return function(){document.removeEventListener("click",c);document.removeEventListener("keydown",k);};},[]);
return h("details",{className:cx("bg-lang",p.className),ref:ref,open:p.defaultOpen},
h("summary",{title:p.title||"Choose language"},icon(GLOBE,{cls:"bg-lang-globe"}),h("span",null,p.label||"English"),icon(CARET,{cls:"bg-lang-caret",w:1.8})),
h("ul",{className:"bg-lang-list"},(p.items||[]).map(function(i){return h("li",{key:i.name},h("a",{href:i.href||"#",lang:i.lang,hrefLang:i.lang,"aria-current":i.current?"true":undefined},i.name));})));}

function Button(p){var q=omit(p,["variant","size","className"]);var tag=q.href?"a":"button";if(tag==="button"&&!q.type)q.type="button";
q.className=cx("bg-btn","bg-btn-"+(p.variant||"outline"),p.size==="sm"&&"bg-btn-sm",p.className);return h(tag,q);}

function CopyButton(p){var st=R.useState(false),on=st[0],set=st[1];
function copy(){var t=typeof p.getText==="function"?p.getText():(p.text||"");
var done=function(){set(true);setTimeout(function(){set(false);},2000);};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,done);}else{done();}}
return h("button",{type:"button",className:cx("bg-copy",p.className),"data-copied":on?"":undefined,onClick:copy},on?(p.copiedLabel||"Copied"):(p.label||"Copy"));}

function PromoBar(p){var open=p.open!==false;
return h("aside",{className:cx("bg-promo",open&&"is-open",p.className),hidden:p.hidden},
h("div",{className:"bg-shell bg-promo-inner"},
h("p",{className:"bg-promo-text"},p.text),
h("span",{className:"bg-promo-actions"},p.children),
h(IconButton,{label:p.closeLabel||"Close",size:"sm",onClick:p.onClose},icon(CLOSE,{w:1.8}))));}

function Hero(p){return h("div",{className:cx("bg-shell","bg-hero",p.className)},h("h1",null,p.title),p.lede?h("p",{className:"bg-lede"},p.lede):null,p.children?h("div",{className:"bg-hero-links"},p.children):null);}

function Section(p){return h("section",{id:p.id,className:cx("bg-section",p.className)},h("div",{className:"bg-shell"},p.title?h("div",{className:"bg-section-head"},h("h2",null,p.title),p.lede?h("p",null,p.lede):null):null,p.children));}

function Steps(p){return h("ol",{className:cx("bg-steps",p.className)},(p.items||[]).map(function(s,i){return h("li",{className:"bg-step",key:i},h("h3",null,s.title),h("p",null,s.body));}));}

function CodeBlock(p){var text=typeof p.children==="string"?p.children:"";
return h("div",{className:cx("bg-code",p.prompt&&"bg-code-prompt",p.className)},
h("div",{className:"bg-code-bar"},h("span",{className:"bg-code-label"},p.label||"terminal"),h(CopyButton,{text:text,label:p.copyLabel,copiedLabel:p.copiedLabel})),
h("pre",{dir:"ltr",tabIndex:0},h("code",null,p.children)));}

function Note(p){return h("div",{className:cx("bg-note",p.className)},h("p",null,p.title?h("strong",null,p.title):null,p.children));}

function Footer(p){return h("footer",{className:cx("bg-footer",p.className)},h("div",{className:"bg-shell bg-footer-inner"},h("span",null,p.children),h("div",{className:"bg-footer-social"},p.social,p.meta?h("span",{className:"bg-footer-meta"},p.meta):null)));}

function Chip(p){var q=omit(p,["selected","className"]);q.type=q.type||"button";q["aria-pressed"]=p.selected?"true":"false";q.className=cx("bg-chip",p.className);return h("button",q);}

function TextField(p){var q=omit(p,["label","hint","error","errorLabel","className"]);
var id=q.id||("bg-f-"+String(p.label||"field").replace(/\W+/g,"-"));q.id=id;
q.className=cx("bg-input",p.error&&"bg-input-error",p.className);
if(p.error)q["aria-invalid"]="true";
if(p.error||p.hint)q["aria-describedby"]=id+"-msg";
return h("div",{className:"bg-field"},
p.label?h("label",{htmlFor:id,className:"bg-field-label"},p.label):null,
h("input",q),
(p.error||p.hint)?h("p",{id:id+"-msg",className:cx("bg-field-msg",p.error&&"bg-field-msg-error")},p.error?h("strong",null,(p.errorLabel||"Error")+": "):null,p.error||p.hint):null);}

function Switch(p){var st=R.useState(!!p.defaultChecked),on=p.checked!==undefined?p.checked:st[0];
return h("button",{type:"button",role:"switch","aria-checked":on?"true":"false",disabled:p.disabled,className:cx("bg-switch",p.className),onClick:function(){st[1](!on);if(p.onChange)p.onChange(!on);}},
h("span",{className:"bg-switch-track"},h("span",{className:"bg-switch-thumb"})),
p.label?h("span",null,p.label):null);}

function Dialog(p){return h("div",{className:cx("bg-dialog",p.className),role:"dialog","aria-modal":"true","aria-labelledby":"bg-dialog-title"},
h("h3",{id:"bg-dialog-title",className:"bg-dialog-title"},p.title),
h("div",{className:"bg-dialog-body"},p.children),
p.actions?h("div",{className:"bg-dialog-actions"},p.actions):null);}

function Snackbar(p){return h("div",{className:cx("bg-snackbar",p.className),role:"status"},h("p",null,p.message),p.action);}

function SocialCard(p){var s=p.scale||0.5;
return h("div",{className:cx("bg-social-wrap",p.className),style:{width:1200*s,height:630*s}},
h("div",{className:"bg-social","data-theme":"dark",style:{transform:"scale("+s+")"}},
h("div",{className:"bg-social-top"},h("span",{className:"bg-social-mark","aria-hidden":"true"}),h("span",null,p.name||"bugra")),
h("div",null,h("h1",null,p.title,p.accent?" ":null,p.accent?h("em",null,p.accent):null),p.sub?h("p",null,p.sub):null),
h("div",{className:"bg-social-bottom"},p.url?h("div",{className:"bg-social-url",dir:"ltr"},p.url):null)));}

var api={SkipLink:SkipLink,Wordmark:Wordmark,Masthead:Masthead,NavLink:NavLink,IconButton:IconButton,LanguageMenu:LanguageMenu,Button:Button,CopyButton:CopyButton,PromoBar:PromoBar,Hero:Hero,Section:Section,Steps:Steps,CodeBlock:CodeBlock,Note:Note,Footer:Footer,Chip:Chip,TextField:TextField,Switch:Switch,Dialog:Dialog,Snackbar:Snackbar,SocialCard:SocialCard};
window.Bugra=window.Bugra||{};Object.assign(window.Bugra,api);
})();
