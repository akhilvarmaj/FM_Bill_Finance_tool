"use client";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
export function ReportChart({ data }: { data: { name: string; amount: number }[] }) {
  return <div style={{ width: "100%", height: 280 }} aria-label="Monthly invoiced sales"><ResponsiveContainer><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis width={75} /><Tooltip /><Bar dataKey="amount" name="Sales (INR)" fill="#287d70" maxBarSize={60} /></BarChart></ResponsiveContainer></div>;
}