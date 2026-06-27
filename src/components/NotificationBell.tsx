"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { fetchNotifications, getUnreadCount, markNotificationRead, markAllRead, type Notification } from "@/server/notification-actions";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function load() {
    setUnread(await getUnreadCount());
  }
  async function openPanel() {
    setNotifs(await fetchNotifications(8));
    setOpen(true);
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={open ? () => setOpen(false) : openPanel} className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" aria-label="Notifications">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-kp-danger px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right animate-fade-up rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Notifications</span>
            {unread > 0 && (
              <button onClick={async () => { await markAllRead(); setUnread(0); setNotifs((n) => n.map((x) => ({ ...x, read: 1 }))); }} className="text-xs text-kp-primary hover:underline">Mark all read</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No notifications yet.</p>
            ) : (
              notifs.map((n) => (
                <NotifItem key={n.id} notif={n} onRead={() => { markNotificationRead(n.id); setUnread((u) => Math.max(0, u - 1)); setNotifs((ns) => ns.map((x) => x.id === n.id ? { ...x, read: 1 } : x)); }} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifItem({ notif, onRead }: { notif: Notification; onRead: () => void }) {
  const Wrapper = notif.link ? ({ children }: { children: React.ReactNode }) => <Link href={notif.link!} onClick={onRead}>{children}</Link> : ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return (
    <Wrapper>
      <div className={`flex cursor-pointer items-start gap-3 border-b border-gray-50 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-800/50 ${!notif.read ? "bg-kp-primary/5" : ""}`} onClick={() => { if (!notif.read) onRead(); }}>
        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notif.read ? "bg-gray-300 dark:bg-gray-600" : "bg-kp-primary"}`} />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${notif.read ? "text-gray-500 dark:text-gray-400" : "font-semibold text-gray-800 dark:text-gray-200"}`}>{notif.title}</p>
          {notif.message && <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{notif.message}</p>}
        </div>
      </div>
    </Wrapper>
  );
}
