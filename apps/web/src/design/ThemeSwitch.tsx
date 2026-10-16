'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { LuMoon, LuSun, LuMonitor, LuPalette } from 'react-icons/lu'

type Mode = 'system' | 'light' | 'dark'
const choices: { mode: Mode; label: string; icon: typeof LuMoon }[] = [
  { mode: 'light', label: 'Light', icon: LuSun },
  { mode: 'dark', label: 'Dark', icon: LuMoon },
  { mode: 'system', label: 'System', icon: LuMonitor },
]
function readMode():Mode {
  if (typeof window === 'undefined') return 'system'
  const value = window.localStorage.getItem('zerynex-theme')
  return value === 'light' || value === 'dark' ? value : 'system'
}
function applyMode(mode:Mode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.setAttribute('data-theme', mode === 'system' ? prefersDark ? 'dark' : 'light' : mode)
  document.documentElement.style.colorScheme = mode === 'system' ? 'light dark' : mode
}
export default function ThemeSwitch() {
  const [mode,setMode] = useState<Mode>('system')
  const [open,setOpen] = useState(false)
  const reduced = useReducedMotion()
  useEffect(()=>{
    const saved = readMode();applyMode(saved)
    let active=true
    queueMicrotask(()=>{if(active)setMode(saved)})
    const media=window.matchMedia('(prefers-color-scheme: dark)')
    const onChange=()=>{ if(readMode()==='system')applyMode('system') }
    media.addEventListener('change',onChange)
    return ()=>{active=false;media.removeEventListener('change',onChange)}
  },[])
  const choose=(next:Mode)=>{
    setMode(next);setOpen(false)
    if (next==='system') window.localStorage.removeItem('zerynex-theme')
    else window.localStorage.setItem('zerynex-theme',next)
    applyMode(next)
  }
  const Current=choices.find(item=>item.mode===mode)?.icon??LuPalette
  return <div className="zn-theme" data-theme-control>
    <AnimatePresence>
      {open&&<motion.div className="zn-theme-options" role="group" aria-label="Color theme"
        initial={reduced?false:{opacity:0,y:9,scale:.97}}
        animate={{opacity:1,y:0,scale:1}}
        exit={reduced?{opacity:0}:{opacity:0,y:6,scale:.97}}
        transition={{duration:.2,ease:[.2,.7,.2,1]}}>
        <span>APPEARANCE</span>
        {choices.map(({mode:option,label,icon:Icon})=><button key={option} type="button" aria-pressed={option===mode}
          onClick={()=>choose(option)}><Icon size={17}/>{label}</button>)}
      </motion.div>}
    </AnimatePresence>
    <button type="button" className="zn-theme-trigger" aria-label="Change color theme" aria-expanded={open} onClick={()=>setOpen(!open)}>
      <Current size={18}/><span>THEME</span>
    </button>
  </div>
}
