-- BoralancesOS / Hyprland 0.55 Lua API. Pin compositor + portal together.
-- Browser and terminal have their own Oracle-only compatibility wrappers.
-- Keep software-rendering variables out of launchers, games and the compositor.
local function app(command) return hl.dsp.exec_cmd(command) end
-- Built with the same pinned Hyprland headers as the compositor.
hl.plugin.load("/etc/boralances/hyprbars.so")
if hl.plugin.hyprbars ~= nil then
  hl.config({plugin={hyprbars={bar_height=30,bar_color="rgb(192337)",
    bar_text_font="Inter",bar_text_size=11,bar_buttons_alignment="left",
    bar_padding=12,bar_button_padding=9,bar_blur=false,icon_on_hover=true,
    on_double_click=[[hyprctl eval 'hl.dispatch(hl.dsp.window.fullscreen({mode="maximized",action="toggle"}))']]}}})
  for _,button in ipairs({
    {"ff6a6d","Ã—",[[hyprctl eval 'hl.dispatch(hl.dsp.window.close())']]},
    {"f6c253","âˆ’","boralances-control minimize"},
    {"64ce88","+",[[hyprctl eval 'hl.dispatch(hl.dsp.window.fullscreen({mode="maximized",action="toggle"}))']]}
  }) do
    hl.plugin.hyprbars.add_button({bg_color="rgb("..button[1]..")",fg_color="rgb(202535)",size=13,icon=button[2],action=button[3]})
  end
  hl.window_rule({match={class="^boralances-(launcher|settings|control-center|quick-settings|calendar|system-menu|start-menu|center|file-menu|go-menu|shortcuts|welcome|installer|gpu-center|nvidia-center|devices|audio-center)$"},["hyprbars:no_bar"]=true})
  hl.window_rule({match={class="^(org.gnome.SystemMonitor|org.gnome.Evince|org.gnome.Calculator|org.gnome.Nautilus)$"},["hyprbars:no_bar"]=true})
end
local virtual_display = os.getenv("BORALANCES_VM_DISPLAY")
-- VirtualBox's synthetic physical dimensions can incorrectly select 200% DPI.
hl.monitor({ output = "", mode = virtual_display or "preferred", position = "auto", scale = virtual_display and 1 or "auto" })
hl.env("XCURSOR_SIZE", "24")
hl.env("XCURSOR_THEME", "Adwaita")
hl.env("HYPRCURSOR_SIZE", "24")
hl.config({
  general = {
    gaps_in = 5, gaps_out = 12, border_size = 1, layout = "dwindle",
    resize_on_border = true, allow_tearing = false,
    col = { active_border = { colors = { "rgba(8cbdffcc)", "rgba(cab3ff77)" }, angle = 45 },
            inactive_border = "rgba(ffffff18)" },
  },
  decoration = {
    rounding = 16, rounding_power = 2,
    active_opacity = 1.0, inactive_opacity = 1.0,
    shadow = { enabled = true, range = 18, render_power = 3, color = 0x44000000 },
    blur = { enabled = true, size = 4, passes = 2, vibrancy = 0.14 },
  },
  animations = { enabled = true },
  cursor = { enable_hyprcursor = false, invisible = false, inactive_timeout = 0,
             no_hardware_cursors = os.getenv("BORALANCES_VM_DISPLAY") and 1 or 2 },
  input = { kb_layout = "us,tr", kb_options = "grp:alt_shift_toggle", follow_mouse = 0,
            touchpad = { natural_scroll = true, tap_to_click = true } },
  dwindle = { preserve_split = true },
  -- UWSM provides process supervision; keep upstream startup notices out of
  -- the branded session while retaining the compositor's error reporting.
  misc = { disable_hyprland_logo = true, disable_splash_rendering = true,
           disable_watchdog_warning = true, force_default_wallpaper = 0 },
})
hl.curve("glass", { type = "spring", mass = 1, stiffness = 260, dampening = 27 })
hl.curve("settle", { type = "bezier", points = { {0.16, 1}, {0.3, 1} } })
hl.animation({ leaf = "windows", enabled = true, speed = 3.0, spring = "glass", style = "popin 96%" })
hl.animation({ leaf = "workspaces", enabled = true, speed = 2.8, bezier = "settle", style = "slide" })
hl.animation({ leaf = "fade", enabled = true, speed = 1.6, bezier = "settle" })
for _, namespace in ipairs({ "waybar", "nwg-dock", "rofi", "notifications", "boralances-widgets" }) do
  hl.layer_rule({ match = { namespace = namespace }, blur = true, blur_popups = true, ignore_alpha = 0.1 })
end
local desktop_layout = hl.window_rule({ name = "boralances-floating-desktop", match = { class = ".*" }, float = true, center = true })
function boralances_layout(mode) desktop_layout:set_enabled(mode == "floating") end
hl.window_rule({ match = { title = "^(Welcome to BoralancesOS|Control Center|System Settings|Install BoralancesOS).*" }, float = true, center = true })
hl.window_rule({ match = { class = "boralances-browser" }, size = { 1000, 620 } })
hl.window_rule({ match = { class = "boralances-launcher" }, float = true, center = true, size = { 1100, 660 } })
hl.window_rule({ match = { class = "boralances-quick-settings" }, float = true,
  size = {420,594}, move = {"monitor_w-window_w-14",44}, pin = true, animation = "slide right" })
hl.window_rule({ match = { class = "boralances-calendar" }, float = true,
  size = {390,420}, move = {"monitor_w-window_w-14",44}, pin = true, animation = "slide right" })
hl.window_rule({ match = { class = "boralances-system-menu" }, float = true,
  size = {310,566}, move = {14,44}, pin = true, animation = "slide top" })
hl.window_rule({match={class="^boralances-(file-menu|go-menu)$"},float=true,size={280,326},move={150,44},pin=true,animation="slide top"})
hl.window_rule({ match = { class = "boralances-start-menu" }, float = true, center = true,
  animation = "popin 96%" })
hl.window_rule({ match = { class = "boralances-center" }, float = true,
  move = {"monitor_w-window_w-14",44}, pin = true, animation = "slide right" })
hl.window_rule({ match = { title = "^Now Playing Center$" }, float = true,
  move = {"(monitor_w-window_w)*0.5",44}, pin = true, animation = "slide top" })
hl.on("hyprland.start", function() hl.exec_cmd("boralances-session") end)
-- Guard bare Windows-key releases so chords never reopen the launcher.
local super_down, super_chord = false, false
local function bind(keys, dispatcher, options)
  hl.bind(keys, function()
    super_chord = true
    hl.dispatch(dispatcher)
  end, options)
end
for _, key in ipairs({"SUPER_L", "SUPER_R"}) do
  hl.bind("SUPER + " .. key, function()
    super_down, super_chord = true, false
  end, {non_consuming=true})
  hl.bind("SUPER + " .. key, function()
    if super_down and not super_chord then hl.exec_cmd("boralances-control start-menu") end
    super_down, super_chord = false, false
  end, {release=true, non_consuming=true})
end
bind("SUPER + Return", app("boralances-terminal"))
bind("SUPER + B", app("boralances-browser"))
bind("SUPER + E", app("thunar"))
bind("SUPER + Space", app("boralances-control start-menu"))
hl.bind("ALT + Alt_L", app("boralances-control window-switcher commit"), {release=true,non_consuming=true,ignore_mods=true})
hl.bind("ALT + Alt_R", app("boralances-control window-switcher commit"), {release=true,non_consuming=true,ignore_mods=true})
hl.bind("ALT + F4", hl.dsp.window.close())
hl.bind("ALT + Tab", app("boralances-control window-switcher next"))
hl.bind("ALT + SHIFT + Tab", app("boralances-control window-switcher previous"))
bind("SUPER + I", app("boralances-control settings"))
bind("SUPER + A", app("boralances-control quick-settings"))
bind("SUPER + R", app("rofi -show run"))
bind("SUPER + D", app("boralances-control show-desktop"))
bind("SUPER + L", app("hyprlock"))
bind("SUPER + M", app("boralances-control minimize"))
bind("SUPER + SHIFT + M", app("boralances-control restore-window"))
hl.bind("CTRL + SHIFT + Escape", app("boralances-task-manager"))
bind("SUPER + left", app("boralances-control snap left"))
bind("SUPER + right", app("boralances-control snap right"))
bind("SUPER + up", hl.dsp.window.fullscreen({mode="maximized",action="set"}))
bind("SUPER + down", app("boralances-control restore-or-minimize"))
bind("SUPER + CTRL + left", hl.dsp.focus({workspace="-1"}))
bind("SUPER + CTRL + right", hl.dsp.focus({workspace="+1"}))
bind("SUPER + Tab", app("boralances-control workspaces"))
bind("SUPER + J", app("boralances-jarvis"))
bind("SUPER + comma", app("boralances-control settings"))
bind("SUPER + CTRL + R", app("boralances-control shell-restart"))
bind("SUPER + SHIFT + 4", app("boralances-control screenshot"))
bind("SUPER + SHIFT + S", app("boralances-control screenshot"))
bind("SUPER + SHIFT + 3", app("boralances-control screenshot-full"))
bind("SUPER + SHIFT + L", app("hyprlock"))
bind("SUPER + Q", hl.dsp.window.close())
bind("SUPER + V", hl.dsp.window.float({ action = "toggle" }))
bind("SUPER + F", hl.dsp.window.fullscreen({ action = "toggle" }))
bind("SUPER + S", app("boralances-control start-menu"))
bind("SUPER + CTRL + S", hl.dsp.workspace.toggle_special("scratch"))
bind("SUPER + CTRL + SHIFT + S", hl.dsp.window.move({ workspace = "special:scratch" }))
bind("SUPER + mouse:272", hl.dsp.window.drag(), { mouse = true })
bind("SUPER + mouse:273", hl.dsp.window.resize(), { mouse = true })
for i = 1, 10 do
  bind("SUPER + " .. i % 10, hl.dsp.focus({ workspace = i }))
  bind("SUPER + SHIFT + " .. i % 10, hl.dsp.window.move({ workspace = i }))
end
for _, direction in ipairs({ "left", "right", "up", "down" }) do
  bind("SUPER + ALT + " .. direction, hl.dsp.focus({ direction = direction }))
end
hl.bind("Print", hl.dsp.exec_cmd("boralances-control screenshot"))
-- Desktop gestures are tested against surfaces locally; normal clicks do not
-- spawn processes or interfere with an app's own right-click menu.
local minimize_on_desktop, last_app = true, nil
local panels = { ["boralances-workspaces"]=true,["boralances-window-switcher"]=true,["boralances-quick-settings"]=true,["boralances-calendar"]=true,
  ["boralances-system-menu"]=true,["boralances-start-menu"]=true,["boralances-center"]=true,
  ["boralances-file-menu"]=true,["boralances-go-menu"]=true }
function boralances_desktop_minimize(enabled) minimize_on_desktop = enabled end
hl.on("window.active", function(w) if w and not panels[w.class] then last_app=w end end)
local function xy(v) return v.x or v[1], v.y or v[2] end
local function bare_desktop()
  local p=hl.get_cursor_pos()
  if not p then return false end
  for _,l in ipairs(hl.get_layers()) do
    if l.mapped and (l.layer > 0 or l.namespace == "boralances-widgets") and
       p.x>=l.x and p.x<l.x+l.w and p.y>=l.y and p.y<l.y+l.h then return false end
  end
  for _,w in ipairs(hl.get_windows({mapped=true})) do
    if w.visible and not w.hidden then
      local x,y=xy(w.at); local width,height=xy(w.size)
      if p.x>=x-2 and p.x<x+width+2 and p.y>=y-32 and p.y<y+height+2 then return false end
    end
  end
  local flag=io.open(os.getenv("XDG_RUNTIME_DIR").."/boralances-dock-popup","r")
  if flag then
    local pid=(flag:read("*a") or ""):match("^(%d+):"); flag:close()
    if pid then local proc=io.open("/proc/"..pid.."/cmdline","r"); if proc then proc:close(); return false end end
  end
  return true
end
hl.bind("mouse:272", function()
  if not bare_desktop() then return end
  local target=hl.get_active_window() or last_app
  for _,w in ipairs(hl.get_windows({mapped=true})) do
    if panels[w.class] then hl.dispatch(hl.dsp.window.close({window=w})) end
  end
  if minimize_on_desktop and target and not panels[target.class] and target.mapped and target.visible then
    hl.exec_cmd("boralances-control minimize-window "..target.address)
  end
end, {non_consuming=true})
-- The file desktop owns its own background right-click menu.
hl.bind("XF86AudioRaiseVolume", hl.dsp.exec_cmd("wpctl set-volume -l 1 @DEFAULT_AUDIO_SINK@ 5%+"), { repeating = true, locked = true })
hl.bind("XF86AudioLowerVolume", hl.dsp.exec_cmd("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-"), { repeating = true, locked = true })
hl.bind("XF86AudioMute", hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle"), { locked = true })
hl.bind("XF86MonBrightnessUp", hl.dsp.exec_cmd("brightnessctl set +5%"), { repeating = true })
hl.bind("XF86MonBrightnessDown", hl.dsp.exec_cmd("brightnessctl set 5%-"), { repeating = true })
hl.gesture({ fingers = 3, direction = "horizontal", action = "workspace" })
local custom = os.getenv("HOME") .. "/.config/hypr/local.lua"
local file = io.open(custom, "r")
if file then file:close(); dofile(custom) end

hl.window_rule({match={class="boralances-window-switcher"},float=true,center=true,size={760,480},animation="popin 96%"})

hl.window_rule({match={class="boralances-workspaces"},float=true,center=true,size={1020,600},animation="popin 96%"})
