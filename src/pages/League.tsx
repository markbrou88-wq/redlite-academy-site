// src/pages/League.tsx
import React from "react";
import { NavLink, Outlet } from "react-router-dom";

export default function League() {
  const link = ({ isActive }: { isActive: boolean }) =>
    isActive ? "font-semibold underline" : "text-gray-600 hover:underline";

  return (
    <div>
      <div className="mb-6 flex gap-6">
        <NavLink to="standings" className={link}>standings</NavLink>
        <NavLink to="leaders" className={link}>leaders</NavLink>
        <NavLink to="games" className={link}>games</NavLink>
      </div>
      <Outlet />
    </div>
  );
}

