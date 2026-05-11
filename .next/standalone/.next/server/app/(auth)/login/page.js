(()=>{var e={};e.id=4665,e.ids=[4665],e.modules={47849:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external")},72934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},55403:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external")},54580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},94749:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external")},45869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},1293:(e,r,t)=>{"use strict";t.r(r),t.d(r,{GlobalError:()=>s.a,__next_app__:()=>m,originalPathname:()=>c,pages:()=>p,routeModule:()=>g,tree:()=>d}),t(67190),t(35866),t(88242);var a=t(23191),n=t(88716),i=t(37922),s=t.n(i),o=t(95231),l={};for(let e in o)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>o[e]);t.d(r,l);let d=["",{children:["(auth)",{children:["login",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(t.bind(t,67190)),"C:\\Users\\makka\\plu-portal-tug\\app\\(auth)\\login\\page.tsx"]}]},{}]},{"not-found":[()=>Promise.resolve().then(t.t.bind(t,35866,23)),"next/dist/client/components/not-found-error"]}]},{layout:[()=>Promise.resolve().then(t.bind(t,88242)),"C:\\Users\\makka\\plu-portal-tug\\app\\layout.tsx"],"not-found":[()=>Promise.resolve().then(t.t.bind(t,35866,23)),"next/dist/client/components/not-found-error"]}],p=["C:\\Users\\makka\\plu-portal-tug\\app\\(auth)\\login\\page.tsx"],c="/(auth)/login/page",m={require:t,loadChunk:()=>Promise.resolve()},g=new a.AppPageRouteModule({definition:{kind:n.x.APP_PAGE,page:"/(auth)/login/page",pathname:"/login",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:d}})},72117:(e,r,t)=>{Promise.resolve().then(t.bind(t,75595))},37752:(e,r,t)=>{Promise.resolve().then(t.bind(t,6844)),Promise.resolve().then(t.bind(t,85999))},56024:(e,r,t)=>{Promise.resolve().then(t.t.bind(t,12994,23)),Promise.resolve().then(t.t.bind(t,96114,23)),Promise.resolve().then(t.t.bind(t,9727,23)),Promise.resolve().then(t.t.bind(t,79671,23)),Promise.resolve().then(t.t.bind(t,41868,23)),Promise.resolve().then(t.t.bind(t,84759,23))},75595:(e,r,t)=>{"use strict";t.r(r),t.d(r,{default:()=>g});var a=t(10326),n=t(17577),i=t(77109),s=t(35047),o=t(91216),l=t(12714),d=t(77506);t(85999);var p=t(25887);function c(){return(0,s.useSearchParams)(),null}function m(){let[e,r]=(0,n.useState)(""),[t,m]=(0,n.useState)(""),[g,u]=(0,n.useState)(!1),[h,b]=(0,n.useState)(""),[x,f]=(0,n.useState)(!1);(0,s.useRouter)();let{data:y,status:v}=(0,i.useSession)(),k=async r=>{if(r.preventDefault(),e&&t){b(""),f(!0);try{let r=await (0,i.signIn)("credentials",{email:e,password:t,redirect:!1});r?.error==="INACTIVE_ACCOUNT"?b("Your account has been deactivated. Please contact your manager."):r?.error&&b("Incorrect email or password. Please try again.")}catch{b("Something went wrong. Please try again.")}finally{f(!1)}}};return"loading"===v?(0,a.jsxs)("div",{style:{position:"fixed",inset:0,zIndex:9999,background:"#1A1008",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"1rem"},children:[a.jsx("div",{style:{fontFamily:"var(--font-display)",color:"#C9A84C",fontSize:"1.5rem",fontWeight:500,letterSpacing:"0.03em"},children:"PLU Management System"}),a.jsx("div",{style:{display:"flex",gap:"6px",marginTop:"0.25rem"},children:[0,1,2].map(e=>a.jsx("div",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"rgba(201,168,76,0.4)",animation:`lp-dot 1.2s ease-in-out ${.2*e}s infinite`}},e))}),a.jsx("style",{children:`
          @keyframes lp-dot {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50%       { opacity: 1;   transform: scale(1.1); }
          }
        `})]}):(0,a.jsxs)("div",{className:"lp-root",children:[(0,a.jsxs)("div",{className:"lp-bg",children:[a.jsx("img",{src:p.o.LOGIN_HERO,alt:"","aria-hidden":"true",onError:e=>{e.target.style.display="none"}}),a.jsx("div",{className:"lp-bg-overlay"})]}),a.jsx("div",{className:"lp-blend","aria-hidden":"true"}),a.jsx("div",{className:"lp-layout",children:(0,a.jsxs)("div",{className:"lp-card",children:[(0,a.jsxs)("div",{className:"lp-card-body",children:[(0,a.jsxs)("div",{className:"lp-brand",children:[a.jsx("div",{className:"lp-brand-name",children:"PLU Management System"}),a.jsx("p",{className:"lp-tagline",children:"Where every moment matters."})]}),a.jsx("div",{className:"lp-divider"}),h&&(0,a.jsxs)("div",{className:"lp-error",role:"alert",children:[(0,a.jsxs)("svg",{width:"15",height:"15",viewBox:"0 0 16 16",fill:"none","aria-hidden":"true",style:{flexShrink:0,marginTop:"1px"},children:[a.jsx("circle",{cx:"8",cy:"8",r:"7",stroke:"#D4826A",strokeWidth:"1.2"}),a.jsx("path",{d:"M8 5v4M8 11v.5",stroke:"#D4826A",strokeWidth:"1.2",strokeLinecap:"round"})]}),a.jsx("span",{children:h})]}),(0,a.jsxs)("form",{onSubmit:k,style:{display:"flex",flexDirection:"column",gap:"0.875rem"},children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"lp-label",htmlFor:"lp-email",children:"Email"}),a.jsx("input",{id:"lp-email",className:"lp-input",type:"email",value:e,onChange:e=>r(e.target.value),placeholder:"your@email.com",required:!0,autoComplete:"email"})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"lp-label",htmlFor:"lp-password",children:"Password"}),(0,a.jsxs)("div",{style:{position:"relative"},children:[a.jsx("input",{id:"lp-password",className:"lp-input",type:g?"text":"password",value:t,onChange:e=>m(e.target.value),placeholder:"••••••••",required:!0,autoComplete:"current-password",style:{paddingRight:"2.75rem"}}),a.jsx("button",{type:"button","aria-label":g?"Hide password":"Show password",onClick:()=>u(e=>!e),className:"lp-eye",children:g?a.jsx(o.Z,{size:15}):a.jsx(l.Z,{size:15})})]})]}),(0,a.jsxs)("button",{type:"submit",disabled:x,className:"lp-btn",style:{marginTop:"0.5rem"},children:[x&&a.jsx(d.Z,{size:15,style:{animation:"lp-spin 1s linear infinite",flexShrink:0}}),x?"Signing in…":"Sign In"]})]}),(0,a.jsxs)("p",{className:"lp-hint",children:["Need access? ",a.jsx("span",{children:"Contact your manager."})]})]}),(0,a.jsxs)("div",{className:"lp-footer",children:[(0,a.jsxs)("p",{children:["\xa9 ",new Date().getFullYear()," PLU Management System"]}),a.jsx("p",{children:"Developed by Khaled \xb7 Supported by Fauzi"})]})]})}),a.jsx(n.Suspense,{children:a.jsx(c,{})}),a.jsx("style",{children:`
        /* ── Root ─────────────────────────────────────────── */
        .lp-root {
          position: relative;
          min-height: 100dvh;
        }

        /* ── Background ───────────────────────────────────── */
        .lp-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          background: #120700;
        }
        .lp-bg img {
          width: 100%; height: 100%;
          object-fit: cover; object-position: center;
        }
        /* Mobile/tablet: heavier warm overlay for readability */
        .lp-bg-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(
            150deg,
            rgba(10, 5, 0, 0.68) 0%,
            rgba(20, 11, 2, 0.50) 55%,
            rgba(12, 6, 1, 0.60) 100%
          );
        }

        /* ── Desktop blend element ────────────────────────── */
        /* Fades the solid left panel smoothly into the hero image */
        .lp-blend {
          display: none;
        }

        /* ── Layout ───────────────────────────────────────── */
        .lp-layout {
          position: relative;
          z-index: 1;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.25rem;
        }

        /* ── Card — glass on mobile/tablet ────────────────── */
        .lp-card {
          width: 100%;
          max-width: 400px;
          background: rgba(14, 7, 1, 0.72);
          backdrop-filter: blur(32px) saturate(1.6);
          -webkit-backdrop-filter: blur(32px) saturate(1.6);
          border: 1px solid rgba(201, 168, 76, 0.16);
          border-radius: 20px;
          padding: 2.25rem 1.875rem 1.875rem;
          box-shadow:
            0 32px 96px rgba(0, 0, 0, 0.70),
            0 2px 0 rgba(255, 255, 255, 0.03) inset,
            0 -1px 0 rgba(0, 0, 0, 0.3) inset;
          position: relative;
          overflow: hidden;
        }
        /* Top edge sheen — catches light like real glass */
        .lp-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(201, 168, 76, 0.35) 30%,
            rgba(255, 255, 255, 0.12) 50%,
            rgba(201, 168, 76, 0.25) 70%,
            transparent 100%
          );
        }

        .lp-card-body { position: relative; z-index: 1; }

        /* ── Brand text ───────────────────────────────────── */
        .lp-brand { text-align: center; margin-bottom: 0.25rem; }
        .lp-brand-name {
          font-family: var(--font-display);
          color: #C9A84C;
          font-size: 1.625rem;
          font-weight: 500;
          letter-spacing: 0.03em;
          line-height: 1.15;
          margin-bottom: 0.35rem;
        }
        .lp-tagline {
          font-family: var(--font-display);
          font-style: italic;
          color: rgba(201, 168, 76, 0.48);
          font-size: 0.875rem;
          margin: 0;
          letter-spacing: 0.01em;
        }

        /* ── Gold divider ─────────────────────────────────── */
        .lp-divider {
          height: 1px;
          margin: 1.5rem 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(201, 168, 76, 0.22) 20%,
            rgba(201, 168, 76, 0.45) 50%,
            rgba(201, 168, 76, 0.22) 80%,
            transparent 100%
          );
        }

        /* ── Error ────────────────────────────────────────── */
        .lp-error {
          background: rgba(90, 22, 10, 0.28);
          border: 1px solid rgba(180, 80, 55, 0.22);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
        }
        .lp-error span {
          font-size: 0.8rem;
          color: #E8937C;
          line-height: 1.5;
        }

        /* ── Label ────────────────────────────────────────── */
        .lp-label {
          display: block;
          font-size: 0.67rem;
          font-weight: 600;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.34);
          margin-bottom: 0.375rem;
        }

        /* ── Input ────────────────────────────────────────── */
        .lp-input {
          width: 100%; height: 44px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: rgba(255, 255, 255, 0.055);
          padding: 0 0.875rem;
          font-size: 0.875rem; color: #fff;
          outline: none; box-sizing: border-box;
          transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease;
          font-family: var(--font-body);
        }
        .lp-input::placeholder { color: rgba(255, 255, 255, 0.17); }
        .lp-input:focus {
          border-color: rgba(201, 168, 76, 0.52);
          background: rgba(255, 255, 255, 0.09);
          box-shadow: 0 0 0 3px rgba(201, 168, 76, 0.09);
        }

        /* ── Eye toggle ───────────────────────────────────── */
        .lp-eye {
          position: absolute; right: 0.75rem; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: rgba(255, 255, 255, 0.26);
          display: flex; align-items: center; padding: 0;
          transition: color 150ms ease;
        }
        .lp-eye:hover { color: rgba(255, 255, 255, 0.55); }

        /* ── Submit button ────────────────────────────────── */
        .lp-btn {
          width: 100%; height: 46px;
          background: linear-gradient(135deg, #D6AB42 0%, #C9A84C 55%, #BA922C 100%);
          color: #160C01;
          border: none; border-radius: 9px;
          font-size: 0.875rem; font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          letter-spacing: 0.055em; font-family: var(--font-body);
          transition: all 220ms ease;
          box-shadow:
            0 2px 18px rgba(180, 140, 40, 0.32),
            0 1px 0 rgba(255, 255, 255, 0.18) inset;
        }
        .lp-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #E2B845 0%, #D4A940 55%, #C49A30 100%);
          box-shadow:
            0 6px 28px rgba(180, 140, 40, 0.48),
            0 1px 0 rgba(255, 255, 255, 0.18) inset;
          transform: translateY(-1px);
        }
        .lp-btn:active:not(:disabled) {
          transform: translateY(0px);
          box-shadow:
            0 2px 10px rgba(180, 140, 40, 0.25),
            0 1px 0 rgba(255, 255, 255, 0.18) inset;
        }
        .lp-btn:disabled { opacity: 0.58; cursor: not-allowed; transform: none; }

        /* ── Hint ─────────────────────────────────────────── */
        .lp-hint {
          margin-top: 1.125rem;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.2);
          text-align: center; line-height: 1.4;
        }
        .lp-hint span { color: rgba(201, 168, 76, 0.46); }

        /* ── Footer ───────────────────────────────────────── */
        .lp-footer {
          text-align: center;
          margin-top: 1.625rem;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.055);
        }
        .lp-footer p {
          margin: 0 0 0.15rem;
          font-size: 0.615rem;
          color: rgba(255, 255, 255, 0.15);
          letter-spacing: 0.05em;
        }

        /* ── Tablet — more breathing room ─────────────────── */
        @media (min-width: 520px) {
          .lp-card {
            max-width: 420px;
            padding: 2.75rem 2.375rem 2.25rem;
            border-radius: 22px;
          }
          .lp-card::before { border-radius: 22px 22px 0 0; }
        }

        /* ── Desktop — solid left panel + image blend ─────── */
        @media (min-width: 1024px) {

          /* Lighter overlay so the right-side hero shines through */
          .lp-bg-overlay {
            background: rgba(8, 4, 0, 0.22);
          }

          /* The blend bar: sits at the right edge of the panel,
             fades the dark #1A1008 into the visible hero image */
          .lp-blend {
            display: block;
            position: fixed;
            left: 448px;
            top: 0; bottom: 0;
            width: 200px;
            background: linear-gradient(
              to right,
              #1A1008 0%,
              rgba(26, 16, 8, 0.55) 40%,
              transparent 100%
            );
            z-index: 1;
            pointer-events: none;
          }

          /* Panel layout */
          .lp-layout {
            justify-content: flex-start;
            align-items: stretch;
            padding: 0;
          }
          .lp-card {
            width: 448px;
            max-width: none;
            flex-shrink: 0;
            min-height: 100dvh;
            border-radius: 0;
            border: none;
            background: #1A1008;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            box-shadow: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem 2.75rem;
            overflow-y: auto;
            position: relative;
          }
          .lp-card::before { display: none; }

          .lp-card-body {
            width: 100%;
            max-width: 360px;
          }
          .lp-brand-name { font-size: 1.75rem; }
          .lp-tagline { font-size: 0.9rem; }
          .lp-divider { margin: 1.75rem 0; }

          /* Footer anchored to bottom of panel */
          .lp-footer {
            position: absolute;
            bottom: 1.75rem; left: 0; right: 0;
            margin: 0; padding: 0; border-top: none;
          }
        }

        /* ── Very small screens ───────────────────────────── */
        @media (max-width: 380px) {
          .lp-layout { padding: 1.25rem 1rem; }
          .lp-card {
            padding: 1.875rem 1.375rem 1.625rem;
            border-radius: 16px;
          }
        }

        /* ── Spin animation ───────────────────────────────── */
        @keyframes lp-spin { to { transform: rotate(360deg); } }
      `})]})}function g(){return a.jsx(n.Suspense,{children:a.jsx(m,{})})}},6844:(e,r,t)=>{"use strict";t.d(r,{default:()=>i});var a=t(10326),n=t(77109);function i({children:e}){return a.jsx(n.SessionProvider,{children:e})}},25887:(e,r,t)=>{"use strict";t.d(r,{o:()=>a});let a={LOGO_WHITE:"/assets/logo-white.svg",LOGO_DARK:"/assets/logo-dark.svg",LOGO_MARK:"/assets/logo-mark.svg",LOGIN_HERO:"/assets/login-hero.jpeg",LOGIN_TEXTURE:"/assets/login-texture.png",SIDEBAR_BG:"/assets/sidebar-bg.png"}},62881:(e,r,t)=>{"use strict";t.d(r,{Z:()=>l});var a=t(17577);/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let n=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),i=(...e)=>e.filter((e,r,t)=>!!e&&t.indexOf(e)===r).join(" ");/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var s={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let o=(0,a.forwardRef)(({color:e="currentColor",size:r=24,strokeWidth:t=2,absoluteStrokeWidth:n,className:o="",children:l,iconNode:d,...p},c)=>(0,a.createElement)("svg",{ref:c,...s,width:r,height:r,stroke:e,strokeWidth:n?24*Number(t)/Number(r):t,className:i("lucide",o),...p},[...d.map(([e,r])=>(0,a.createElement)(e,r)),...Array.isArray(l)?l:[l]])),l=(e,r)=>{let t=(0,a.forwardRef)(({className:t,...s},l)=>(0,a.createElement)(o,{ref:l,iconNode:r,className:i(`lucide-${n(e)}`,t),...s}));return t.displayName=`${e}`,t}},91216:(e,r,t)=>{"use strict";t.d(r,{Z:()=>a});/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,t(62881).Z)("EyeOff",[["path",{d:"M9.88 9.88a3 3 0 1 0 4.24 4.24",key:"1jxqfv"}],["path",{d:"M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68",key:"9wicm4"}],["path",{d:"M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61",key:"1jreej"}],["line",{x1:"2",x2:"22",y1:"2",y2:"22",key:"a6p6uj"}]])},12714:(e,r,t)=>{"use strict";t.d(r,{Z:()=>a});/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,t(62881).Z)("Eye",[["path",{d:"M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z",key:"rwhkz3"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]])},77506:(e,r,t)=>{"use strict";t.d(r,{Z:()=>a});/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,t(62881).Z)("LoaderCircle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]])},35047:(e,r,t)=>{"use strict";var a=t(77389);t.o(a,"useParams")&&t.d(r,{useParams:function(){return a.useParams}}),t.o(a,"usePathname")&&t.d(r,{usePathname:function(){return a.usePathname}}),t.o(a,"useRouter")&&t.d(r,{useRouter:function(){return a.useRouter}}),t.o(a,"useSearchParams")&&t.d(r,{useSearchParams:function(){return a.useSearchParams}})},67190:(e,r,t)=>{"use strict";t.r(r),t.d(r,{$$typeof:()=>s,__esModule:()=>i,default:()=>o});var a=t(68570);let n=(0,a.createProxy)(String.raw`C:\Users\makka\plu-portal-tug\app\(auth)\login\page.tsx`),{__esModule:i,$$typeof:s}=n;n.default;let o=(0,a.createProxy)(String.raw`C:\Users\makka\plu-portal-tug\app\(auth)\login\page.tsx#default`)},88242:(e,r,t)=>{"use strict";t.r(r),t.d(r,{default:()=>h,metadata:()=>u});var a=t(19510),n=t(98593),i=t.n(n),s=t(91815),o=t.n(s);t(67272);var l=t(68570);let d=(0,l.createProxy)(String.raw`C:\Users\makka\plu-portal-tug\components\Providers.tsx`),{__esModule:p,$$typeof:c}=d;d.default;let m=(0,l.createProxy)(String.raw`C:\Users\makka\plu-portal-tug\components\Providers.tsx#default`);var g=t(51032);let u={title:"PLU Management Portal — PLU Management System",description:"PLU request management for PLU Management System restaurant outlets"};function h({children:e}){return a.jsx("html",{lang:"en",className:`${i().variable} ${o().variable}`,children:(0,a.jsxs)("body",{children:[a.jsx(m,{children:e}),a.jsx(g.x7,{position:"bottom-right",toastOptions:{style:{fontFamily:"var(--font-body)"}}})]})})}},67272:()=>{}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),a=r.X(0,[8948,9244],()=>t(1293));module.exports=a})();