import { chromium } from '@playwright/test'

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CI ? {} : {executablePath:'/usr/bin/google-chrome'}),
  args:['--no-sandbox'],
})
const paths = ['/','/ecosystem','/agents','/docs','/docs/installation','/docs/agents','/tools','/tools/stages','/tools/handoff']
const widths = [320,360,390,600,768,980,1024,1440,1920]
const problems=[]
const page=await browser.newPage()
try {
  for (const width of widths) {
    await page.setViewportSize({width,height:900})
    for (const route of paths) {
      await page.goto('http://127.0.0.1:3100'+route,{waitUntil:'domcontentloaded',timeout:25000})
      const state = await page.evaluate(()=>{
        const viewport = document.documentElement.clientWidth
        const main = document.querySelector('main')
        const h1 = document.querySelector('h1')
        const nav = document.querySelector('.zn-site-header')
        const sidebar = document.querySelector('.docs-sidebar')
        const nodes = [...document.querySelectorAll('main *')].filter(el => {
          if (el instanceof SVGElement) return false
          const style = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return rect.width > 20 && rect.height > 12 && style.position !== 'absolute' &&
          style.position !== 'fixed' && style.display !== 'none' && style.visibility !== 'hidden' &&
          (rect.left < -3 || rect.right > viewport+3) &&
          !(['PRE','CODE'].includes(el.tagName) || el.closest('pre, .zn-hero-visual, .zn-language-select, .docs-sidebar'))
        }).slice(0,4).map(el=>({
          selector:el.tagName.toLowerCase()+'.'+String(el.className).slice(0,45),
          left: Math.round(el.getBoundingClientRect().left),
          right: Math.round(el.getBoundingClientRect().right)
        }))
        const b=el=>el?.getBoundingClientRect()
        return {
          scroll:document.documentElement.scrollWidth,
          body:document.body.scrollWidth,
          root:main?.getBoundingClientRect().width,
          hero:h1?Math.round(b(h1).width):0,
          header:Math.round(b(nav).width),
          aside: sidebar ? getComputedStyle(sidebar).display : null,
          nOverflow:nodes,
        }
      })
      if (state.scroll > width+2 || state.body > width+2 || state.nOverflow.length ||
        (width>=1024&&state.hero<400) || state.header > width) {
        problems.push({width,route,...state})
      }
      if ((width===360 || width===1440) && ['/','/ecosystem','/docs','/tools/stages','/agents'].includes(route)) {
        await page.screenshot({path:'/tmp/zerynex-responsive-'+(route==='/'?'home':route.slice(1).replaceAll('/','-'))+'-'+width+'.png'})
      }
    }
  }
  console.log('Routes tested:',paths.length,'viewports:',widths.length,'total:',paths.length*widths.length)
  console.log('Responsive layout issues:',JSON.stringify(problems,null,2))
}finally{await browser.close()}
if(problems.length) process.exitCode=2
