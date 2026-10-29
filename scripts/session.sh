# Started once by the compositor. No browser, launcher, AI or containers at idle.
runtime="${XDG_RUNTIME_DIR:?}/boralances"
mkdir -p "$runtime"
exec 9>"$runtime/session.lock"
flock -n 9 || exit 0
# Seed apps which do not consult XDG_CONFIG_DIRS. Existing user choices win.
configuration_home="${XDG_CONFIG_HOME:-$HOME/.config}"
for relative in nwg-dock-hyprland/style.css rofi/config.rasi hypr/hyprlock.conf hypr/hypridle.conf; do
  if [[ ! -e "$configuration_home/$relative" ]]; then
    mkdir -p "$(dirname -- "$configuration_home/$relative")"
    cp -- "/etc/xdg/$relative" "$configuration_home/$relative"
    chmod u+w -- "$configuration_home/$relative"
  fi
done
cache_home="${XDG_CACHE_HOME:-$HOME/.cache}"
mkdir -p "$cache_home"
if [[ ! -e "$cache_home/nwg-dock-pinned" ]]; then
  printf '%s\n' boralances-files boralances-browser boralances-launcher boralances-terminal boralances-settings boralances-overview boralances-trash > "$cache_home/nwg-dock-pinned"
fi
dunst &
systemctl --user start hyprpolkitagent.service
boralances-control restore || echo 'A saved desktop preference could not be restored.' >&2
# Navigation is supervised separately and the dock is visible by default.
systemctl --user start boralances-menu-bar.service boralances-dock.service boralances-wallpaper.service boralances-idle.service
systemctl --user start boralances-widgets.service
systemctl --user start boralances-desktop-icons.service
if [[ ! -f "${XDG_CONFIG_HOME:-$HOME/.config}/boralances/welcome-seen" ]]; then
  boralances-welcome &
fi
wait
