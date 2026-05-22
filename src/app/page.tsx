"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

type Transaction = {
  date: string;
  category: string;
  amount: number;
  note: string;
  source: string;
  inCalc: boolean;
};

type Budget = {
  name: string;
  amount: number;
  source: string;
};

type MonthlyBill = {
  name: string;
  amount: number;
  day: number;
  source: string;
};

type Shopping = {
  name: string;
  amount: number;
  date: string;
  source: string;
  note?: string;
};

type CashLocation = {
  location: string;
  yen10000: number;
  yen5000: number;
  yen1000: number;
  other: number;
  inRemaining: boolean;
};

type Account = {
  name: string;
  balance: number;
  inRemaining: boolean;
};

type Data = {
  year: number;
  month: number;
  income: number;
  bonus: number;
  other: number;
  lastRemaining: number;
  savings: number;
  yucho: number;
  accounts: Account[];
  monthlyBills: MonthlyBill[];
  shopping: Shopping[];
  transactions: Transaction[];
  cash: CashLocation[];
  budgets: Budget[];
  suica: number;
};

const now = new Date();
const defaultData: Data = {
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  income: 0,
  bonus: 0,
  other: 0,
  lastRemaining: 0,
  savings: 0,
  yucho: 0,
  accounts: [],
  monthlyBills: [],
  shopping: [],
  transactions: [],
  cash: [],
  budgets: [],
  suica: 0,
};

export default function Home() {
  const [data, setData] = useState<Data>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabase();
      const { data: stored } = await supabase
        .from("money_data")
        .select("*")
        .single();

      if (stored?.data) {
        setData({ ...defaultData, ...stored.data } as Data);
      }
    } catch (error) {
      console.error("Error fetching:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveData = async (newData: Data) => {
    setData(newData);
    setIsSaving(true);
    try {
      const supabase = getSupabase();
      await supabase.from("money_data").upsert({ id: 1, data: newData });
      setLastSaved(new Date());
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const totalIncome = data.income + data.bonus + data.other + data.lastRemaining;
  const transfer = totalIncome - data.savings;
  const selectedAccounts = data.accounts.filter((a) => a.inRemaining !== false && a.name !== "Yucho");
  const selectedCash = data.cash.filter((c) => c.inRemaining !== false);
  const getMizuhoBalance = () => {
    const mizuho = data.accounts.find((a) => a.name === "Mizuho");
    return mizuho ? transfer : 0;
  };
  const totalSelectedAccounts = selectedAccounts.reduce((sum, a) => {
    if (a.name === "Mizuho") return sum + transfer;
    return sum + a.balance;
  }, 0);
  const totalSelectedCash = selectedCash.reduce(
    (sum, c) => sum + c.yen10000 * 10000 + c.yen5000 * 5000 + c.yen1000 * 1000 + c.other,
    0
  );

  const getAmountBySource = (items: { amount: number; source: string }[], source: string) =>
    items.filter((i) => i.source === source).reduce((sum, i) => sum + i.amount, 0);

  const calcRemainingBySource = (source: string) => {
    if (source === "Cash") {
      const cashTotal = totalSelectedCash;
      const bills = getAmountBySource(data.monthlyBills, "Cash");
      const shopping = getAmountBySource(data.shopping, "Cash");
      const budget = getAmountBySource(data.budgets, "Cash");
      const transactions = data.transactions.filter((t) => t.source === "Cash" && t.inCalc !== false).reduce((sum, t) => sum + t.amount, 0);
      return {
        base: cashTotal,
        remaining: cashTotal - bills - shopping,
        actual: cashTotal - bills - shopping - budget + transactions,
      };
    } else {
      const account = selectedAccounts.find((a) => a.name === source);
      const accountBalance = source === "Mizuho" ? transfer : (account?.balance || 0);
      const bills = getAmountBySource(data.monthlyBills, source);
      const shopping = getAmountBySource(data.shopping, source);
      const budget = getAmountBySource(data.budgets, source);
      const transactions = data.transactions.filter((t) => t.source === source && t.inCalc !== false).reduce((sum, t) => sum + t.amount, 0);
      return {
        base: accountBalance,
        remaining: accountBalance - bills - shopping,
        actual: accountBalance - bills - shopping - budget + transactions,
      };
    }
  };

  const totalMonthlyBills = data.monthlyBills.reduce((sum, b) => sum + b.amount, 0);
  const totalShopping = data.shopping.reduce((sum, s) => sum + s.amount, 0);
  const totalBudgets = data.budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalTransactions = data.transactions.filter((t) => t.inCalc !== false).reduce((sum, t) => sum + t.amount, 0);

  const remaining = totalSelectedAccounts + totalSelectedCash - totalMonthlyBills - totalShopping;
  const actualRemaining = remaining - totalBudgets + totalTransactions;

  const getSpent = (category: string) =>
    data.transactions
      .filter((t) => t.category === category && t.amount < 0 && t.inCalc !== false)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const daysInMonth = new Date(data.year, data.month, 0).getDate();

  const defaultSource = data.accounts.find((a) => a.name === "Mizuho") ? "Mizuho" : "Cash";
  const sourceOptions = [defaultSource, ...data.accounts.filter((a) => a.name !== "Yucho").map((a) => a.name).filter((n) => n !== defaultSource), "Cash"].filter((v, i, a) => a.indexOf(v) === i);

  const startForm = (field: string, initial: Record<string, string> = {}) => {
    setEditingField(field);
    setFormValues(initial);
  };

  const closeForm = () => {
    setEditingField(null);
    setFormValues({});
  };

  const SourceSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1">
      {sourceOptions.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-400 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono text-sm p-2 pb-16">
      <div className="max-w-lg mx-auto whitespace-pre-wrap">
        <div className="text-center text-yellow-400 font-bold mb-2">
          Money Tracker
        </div>
        <Divider />

        <div className="text-center flex justify-center items-center gap-2">
          <select
            value={data.year}
            onChange={(e) => saveData({ ...data, year: parseInt(e.target.value) })}
            className="bg-black text-green-400 border border-green-600"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          /
          <select
            value={data.month}
            onChange={(e) => saveData({ ...data, month: parseInt(e.target.value) })}
            className="bg-black text-green-400 border border-green-600"
          >
            {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <span className="text-slate-500">({data.month}/1 - {data.month}/{daysInMonth})</span>
        </div>
        <Divider />

        <div className="flex justify-between">
          <span>Income:</span>
          <EditableNumber value={data.income} onChange={(v) => saveData({ ...data, income: v })} />
        </div>
        <div className="flex justify-between">
          <span>+ Bonus:</span>
          <EditableNumber value={data.bonus} onChange={(v) => saveData({ ...data, bonus: v })} />
        </div>
        <div className="flex justify-between">
          <span>+ Other:</span>
          <EditableNumber value={data.other} onChange={(v) => saveData({ ...data, other: v })} />
        </div>
        <div className="flex justify-between">
          <span>+ Remaining:</span>
          <EditableNumber value={data.lastRemaining} onChange={(v) => saveData({ ...data, lastRemaining: v })} />
        </div>
        <div className="text-slate-500">= Total: ¥{totalIncome.toLocaleString()}</div>
        <div className="flex justify-between">
          <span>- Savings:</span>
          <EditableNumber value={data.savings} onChange={(v) => saveData({ ...data, savings: v })} />
        </div>
        <div className="flex justify-between">
          <span>  → Yucho:</span>
          <EditableNumber value={data.yucho} onChange={(v) => saveData({ ...data, yucho: v })} />
        </div>
        <div className="text-slate-500">    (+ Savings = ¥{(data.yucho + data.savings).toLocaleString()})</div>
        <div className="text-slate-500">⇒ Transfer: ¥{transfer.toLocaleString()}</div>
        <Divider />

        <div>Accounts:</div>
        {data.accounts.filter((acc) => acc.name !== "Yucho").map((acc) => {
          const isMizuho = acc.name === "Mizuho";
          const displayBalance = isMizuho ? transfer : acc.balance;
          const originalIndex = data.accounts.findIndex((a) => a.name === acc.name);
          return (
            <div key={acc.name} className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={acc.inRemaining !== false}
                  onChange={(e) => {
                    const newAccounts = [...data.accounts];
                    newAccounts[originalIndex] = { ...acc, inRemaining: e.target.checked };
                    saveData({ ...data, accounts: newAccounts });
                  }}
                  className="accent-green-400"
                />
                {acc.name}:
              </span>
              <span className="flex items-center gap-2">
                {isMizuho ? (
                  <span className="text-slate-500">¥{displayBalance.toLocaleString()} (= Transfer)</span>
                ) : (
                  <EditableNumber
                    value={acc.balance}
                    onChange={(v) => {
                      const newAccounts = [...data.accounts];
                      newAccounts[originalIndex] = { ...acc, balance: v };
                      saveData({ ...data, accounts: newAccounts });
                    }}
                  />
                )}
                {!isMizuho && (
                  <button onClick={() => saveData({ ...data, accounts: data.accounts.filter((_, idx) => idx !== originalIndex) })} className="text-red-400 text-xs">Del</button>
                )}
              </span>
            </div>
          );
        })}
        {editingField === "account" ? (
          <div className="bg-slate-900 p-2 my-1">
            <input placeholder="Account name" value={formValues.name || ""} onChange={(e) => setFormValues({ ...formValues, name: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <div className="flex gap-2">
              <button onClick={() => {
                if (formValues.name) {
                  saveData({ ...data, accounts: [...data.accounts, { name: formValues.name, balance: 0, inRemaining: true }] });
                  closeForm();
                }
              }} className="text-blue-400">Save</button>
              <button onClick={closeForm} className="text-slate-500">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => startForm("account")} className="text-blue-400 text-xs">+ Add Account</button>
        )}
        <div className="text-slate-500">Total Accounts: ¥{totalSelectedAccounts.toLocaleString()}</div>
        <Divider />

        <CashSection
          data={data}
          saveData={saveData}
          editingField={editingField}
          formValues={formValues}
          setFormValues={setFormValues}
          startForm={startForm}
          closeForm={closeForm}
        />
        <div className="text-slate-500">Total Cash: ¥{totalSelectedCash.toLocaleString()}</div>
        <div className="text-slate-500">Selected (Accounts + Cash): ¥{(totalSelectedAccounts + totalSelectedCash).toLocaleString()}</div>
        <Divider />

        <div className="flex justify-between">
          <span>Monthly Bills</span>
          <span className="text-slate-500">-¥{totalMonthlyBills.toLocaleString()}</span>
        </div>
        {data.monthlyBills.map((bill, i) => (
          <div key={i}>
            <div className="flex justify-between items-center">
              <span>¥{bill.amount.toLocaleString()} Day {bill.day}: {bill.name} ({bill.source || defaultSource})</span>
              <span className="flex gap-1">
                <button onClick={() => startForm(`bill-edit-${i}`, {
                  name: bill.name,
                  amount: String(bill.amount),
                  day: String(bill.day),
                  source: bill.source || defaultSource
                })} className="text-blue-400 text-xs">Edit</button>
                <button onClick={() => saveData({ ...data, monthlyBills: data.monthlyBills.filter((_, idx) => idx !== i) })} className="text-red-400 text-xs">Del</button>
              </span>
            </div>
            {editingField === `bill-edit-${i}` && (
              <div className="bg-slate-900 p-2 my-1">
                <input placeholder="Name" value={formValues.name || ""} onChange={(e) => setFormValues({ ...formValues, name: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <input placeholder="Amount" type="number" value={formValues.amount || ""} onChange={(e) => setFormValues({ ...formValues, amount: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <input placeholder="Day (1-31)" type="number" value={formValues.day || ""} onChange={(e) => setFormValues({ ...formValues, day: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <SourceSelect value={formValues.source || defaultSource} onChange={(v) => setFormValues({ ...formValues, source: v })} />
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (formValues.name && formValues.amount && formValues.day) {
                      const newBills = [...data.monthlyBills];
                      newBills[i] = { name: formValues.name, amount: parseInt(formValues.amount), day: parseInt(formValues.day), source: formValues.source || defaultSource };
                      saveData({ ...data, monthlyBills: newBills.sort((a, b) => a.day - b.day) });
                      closeForm();
                    }
                  }} className="text-blue-400">Save</button>
                  <button onClick={closeForm} className="text-slate-500">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {editingField === "bill" ? (
          <div className="bg-slate-900 p-2 my-1">
            <input placeholder="Name" value={formValues.name || ""} onChange={(e) => setFormValues({ ...formValues, name: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <input placeholder="Amount" type="number" value={formValues.amount || ""} onChange={(e) => setFormValues({ ...formValues, amount: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <input placeholder="Day (1-31)" type="number" value={formValues.day || ""} onChange={(e) => setFormValues({ ...formValues, day: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <SourceSelect value={formValues.source || defaultSource} onChange={(v) => setFormValues({ ...formValues, source: v })} />
            <div className="flex gap-2">
              <button onClick={() => {
                if (formValues.name && formValues.amount && formValues.day) {
                  saveData({ ...data, monthlyBills: [...data.monthlyBills, { name: formValues.name, amount: parseInt(formValues.amount), day: parseInt(formValues.day), source: formValues.source || defaultSource }].sort((a, b) => a.day - b.day) });
                  closeForm();
                }
              }} className="text-blue-400">Save</button>
              <button onClick={closeForm} className="text-slate-500">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => startForm("bill", { source: defaultSource })} className="text-blue-400 text-xs">+ Add Bill</button>
        )}
        <div className="text-slate-600 text-xs flex justify-between">
          <span>→ After Bills:</span>
          <span>¥{(totalSelectedAccounts + totalSelectedCash - totalMonthlyBills).toLocaleString()}</span>
        </div>
        <Divider />

        <div className="flex justify-between">
          <span>Shopping</span>
          <span className="text-slate-500">-¥{totalShopping.toLocaleString()}</span>
        </div>
        {data.shopping.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between items-center">
              <span>{item.source || defaultSource}: {item.name}: ¥{item.amount.toLocaleString()} {item.date}</span>
              <span className="flex gap-1">
                {i > 0 && (
                  <button onClick={() => {
                    const newShopping = [...data.shopping];
                    [newShopping[i - 1], newShopping[i]] = [newShopping[i], newShopping[i - 1]];
                    saveData({ ...data, shopping: newShopping });
                  }} className="text-slate-500 text-xs">↑</button>
                )}
                {i < data.shopping.length - 1 && (
                  <button onClick={() => {
                    const newShopping = [...data.shopping];
                    [newShopping[i], newShopping[i + 1]] = [newShopping[i + 1], newShopping[i]];
                    saveData({ ...data, shopping: newShopping });
                  }} className="text-slate-500 text-xs">↓</button>
                )}
                <button onClick={() => startForm(`shopping-edit-${i}`, {
                  source: item.source,
                  name: item.name,
                  amount: String(item.amount),
                  date: item.date,
                  note: item.note || ""
                })} className="text-blue-400 text-xs">Edit</button>
              </span>
            </div>
            {item.note && <div className="text-slate-500 text-xs ml-4">{item.note}</div>}
            {editingField === `shopping-edit-${i}` && (
              <div className="bg-slate-900 p-2 my-1">
                <SourceSelect value={formValues.source || defaultSource} onChange={(v) => setFormValues({ ...formValues, source: v })} />
                <input placeholder="Name" value={formValues.name || ""} onChange={(e) => setFormValues({ ...formValues, name: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <input placeholder="Amount" type="number" value={formValues.amount || ""} onChange={(e) => setFormValues({ ...formValues, amount: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <input placeholder="Date (e.g. 5/25)" value={formValues.date || ""} onChange={(e) => setFormValues({ ...formValues, date: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <input placeholder="Note (optional)" value={formValues.note || ""} onChange={(e) => setFormValues({ ...formValues, note: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (formValues.name && formValues.amount && formValues.date) {
                      const newShopping = [...data.shopping];
                      newShopping[i] = { source: formValues.source || defaultSource, name: formValues.name, amount: parseInt(formValues.amount), date: formValues.date, note: formValues.note || undefined };
                      saveData({ ...data, shopping: newShopping });
                      closeForm();
                    }
                  }} className="text-blue-400">Save</button>
                  <button onClick={closeForm} className="text-slate-500">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {editingField === "shopping" ? (
          <div className="bg-slate-900 p-2 my-1">
            <SourceSelect value={formValues.source || defaultSource} onChange={(v) => setFormValues({ ...formValues, source: v })} />
            <input placeholder="Name" value={formValues.name || ""} onChange={(e) => setFormValues({ ...formValues, name: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <input placeholder="Amount" type="number" value={formValues.amount || ""} onChange={(e) => setFormValues({ ...formValues, amount: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <input placeholder="Date (e.g. 5/25)" value={formValues.date || ""} onChange={(e) => setFormValues({ ...formValues, date: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <input placeholder="Note (optional)" value={formValues.note || ""} onChange={(e) => setFormValues({ ...formValues, note: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <div className="flex gap-2">
              <button onClick={() => {
                if (formValues.name && formValues.amount && formValues.date) {
                  saveData({ ...data, shopping: [...data.shopping, { source: formValues.source || defaultSource, name: formValues.name, amount: parseInt(formValues.amount), date: formValues.date, note: formValues.note || undefined }] });
                  closeForm();
                }
              }} className="text-blue-400">Save</button>
              <button onClick={closeForm} className="text-slate-500">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => startForm("shopping", { source: defaultSource })} className="text-blue-400 text-xs">+ Add Shopping</button>
        )}
        <div className="text-slate-600 text-xs flex justify-between">
          <span>→ After Shopping:</span>
          <span>¥{remaining.toLocaleString()}</span>
        </div>
        <Divider />

        <div className="flex justify-between text-yellow-400 font-bold">
          <span>Remaining</span>
          <span>¥{remaining.toLocaleString()}</span>
        </div>
        {selectedAccounts.map((acc) => {
          const r = calcRemainingBySource(acc.name);
          return (
            <div key={acc.name} className="text-slate-500 text-xs flex justify-between">
              <span>  {acc.name}</span>
              <span>¥{r.remaining.toLocaleString()}</span>
            </div>
          );
        })}
        {selectedCash.length > 0 && (
          <div className="text-slate-500 text-xs flex justify-between">
            <span>  Cash</span>
            <span>¥{calcRemainingBySource("Cash").remaining.toLocaleString()}</span>
          </div>
        )}
        <Divider />

        <div>Budget:</div>
        {data.budgets.map((b, i) => {
          const spent = getSpent(b.name);
          const left = b.amount - spent;
          return (
            <div key={i}>
              <div className="flex justify-between items-center">
                <span>{b.name} ({b.source})</span>
                <span className="flex items-center gap-2">
                  <span className={left < 0 ? "text-red-400" : ""}>¥{left.toLocaleString()} / ¥{b.amount.toLocaleString()}</span>
                  <button onClick={() => startForm(`budget-edit-${i}`, {
                    name: b.name,
                    amount: String(b.amount),
                    source: b.source
                  })} className="text-blue-400 text-xs">Edit</button>
                  <button onClick={() => saveData({ ...data, budgets: data.budgets.filter((_, idx) => idx !== i) })} className="text-red-400 text-xs">Del</button>
                </span>
              </div>
              {editingField === `budget-edit-${i}` && (
                <div className="bg-slate-900 p-2 my-1">
                  <input placeholder="Category (e.g. Lunch)" value={formValues.name || ""} onChange={(e) => setFormValues({ ...formValues, name: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                  <input placeholder="Budget amount" type="number" value={formValues.amount || ""} onChange={(e) => setFormValues({ ...formValues, amount: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                  <SourceSelect value={formValues.source || defaultSource} onChange={(v) => setFormValues({ ...formValues, source: v })} />
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if (formValues.name && formValues.amount) {
                        const newBudgets = [...data.budgets];
                        newBudgets[i] = { name: formValues.name, amount: parseInt(formValues.amount), source: formValues.source || defaultSource };
                        saveData({ ...data, budgets: newBudgets });
                        closeForm();
                      }
                    }} className="text-blue-400">Save</button>
                    <button onClick={closeForm} className="text-slate-500">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {editingField === "budget" ? (
          <div className="bg-slate-900 p-2 my-1">
            <input placeholder="Category (e.g. Lunch)" value={formValues.name || ""} onChange={(e) => setFormValues({ ...formValues, name: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <input placeholder="Budget amount" type="number" value={formValues.amount || ""} onChange={(e) => setFormValues({ ...formValues, amount: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <SourceSelect value={formValues.source || defaultSource} onChange={(v) => setFormValues({ ...formValues, source: v })} />
            <div className="flex gap-2">
              <button onClick={() => {
                if (formValues.name && formValues.amount) {
                  saveData({ ...data, budgets: [...data.budgets, { name: formValues.name, amount: parseInt(formValues.amount), source: formValues.source || defaultSource }] });
                  closeForm();
                }
              }} className="text-blue-400">Save</button>
              <button onClick={closeForm} className="text-slate-500">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => startForm("budget", { source: defaultSource })} className="text-blue-400 text-xs">+ Add Budget</button>
        )}
        <div className="text-slate-500">Total Budget: -¥{totalBudgets.toLocaleString()}</div>
        <div className="text-slate-600 text-xs flex justify-between">
          <span>→ After Budget:</span>
          <span>¥{(remaining - totalBudgets).toLocaleString()}</span>
        </div>
        <Divider />

        <div>Transactions:</div>
        {data.transactions.map((t, i) => (
          <div key={i}>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={t.inCalc !== false}
                  onChange={(e) => {
                    const newTrans = [...data.transactions];
                    newTrans[i] = { ...t, inCalc: e.target.checked };
                    saveData({ ...data, transactions: newTrans });
                  }}
                  className="accent-green-400"
                />
                <span className={t.inCalc === false ? "text-slate-600" : ""}>
                  {t.date} {t.category} {t.amount >= 0 ? "+" : ""}¥{Math.abs(t.amount).toLocaleString()} {t.source}
                </span>
              </span>
              <span className="flex gap-1">
                <button onClick={() => startForm(`trans-edit-${i}`, {
                  date: t.date,
                  category: t.category,
                  amount: String(t.amount),
                  source: t.source,
                  note: t.note || "",
                  inCalc: t.inCalc === false ? "false" : "true"
                })} className="text-blue-400 text-xs">Edit</button>
                <button onClick={() => saveData({ ...data, transactions: data.transactions.filter((_, idx) => idx !== i) })} className="text-red-400 text-xs">Del</button>
              </span>
            </div>
            {t.note && (
              <div className="text-slate-500 text-xs ml-5 whitespace-pre-wrap">{t.note}</div>
            )}
            {editingField === `trans-edit-${i}` && (
              <div className="bg-slate-900 p-2 my-1">
                <input placeholder="Date (e.g. 5/25)" value={formValues.date || ""} onChange={(e) => setFormValues({ ...formValues, date: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <input placeholder="Category" value={formValues.category || ""} onChange={(e) => setFormValues({ ...formValues, category: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <input placeholder="Amount (negative for expense)" type="number" value={formValues.amount || ""} onChange={(e) => setFormValues({ ...formValues, amount: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <SourceSelect value={formValues.source || defaultSource} onChange={(v) => setFormValues({ ...formValues, source: v })} />
                <textarea placeholder="Note (optional, Shift+Enter for newline)" value={formValues.note || ""} onChange={(e) => setFormValues({ ...formValues, note: e.target.value })} rows={2} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1 resize-none" />
                <label className="flex items-center gap-2 mb-1">
                  <input type="checkbox" checked={formValues.inCalc !== "false"} onChange={(e) => setFormValues({ ...formValues, inCalc: e.target.checked ? "true" : "false" })} className="accent-green-400" />
                  <span>Include in calculation</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (formValues.date && formValues.category && formValues.amount) {
                      const newTrans = [...data.transactions];
                      newTrans[i] = { date: formValues.date, category: formValues.category, amount: parseInt(formValues.amount), source: formValues.source || defaultSource, note: formValues.note || "", inCalc: formValues.inCalc !== "false" };
                      saveData({ ...data, transactions: newTrans });
                      closeForm();
                    }
                  }} className="text-blue-400">Save</button>
                  <button onClick={closeForm} className="text-slate-500">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {editingField === "transaction" ? (
          <div className="bg-slate-900 p-2 my-1">
            <input placeholder="Date (e.g. 5/25)" value={formValues.date || `${data.month}/${new Date().getDate()}`} onChange={(e) => setFormValues({ ...formValues, date: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <input placeholder="Category" value={formValues.category || ""} onChange={(e) => setFormValues({ ...formValues, category: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <input placeholder="Amount (negative for expense)" type="number" value={formValues.amount || ""} onChange={(e) => setFormValues({ ...formValues, amount: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
            <SourceSelect value={formValues.source || defaultSource} onChange={(v) => setFormValues({ ...formValues, source: v })} />
            <textarea placeholder="Note (optional, Shift+Enter for newline)" value={formValues.note || ""} onChange={(e) => setFormValues({ ...formValues, note: e.target.value })} rows={2} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1 resize-none" />
            <label className="flex items-center gap-2 mb-1">
              <input type="checkbox" checked={formValues.inCalc !== "false"} onChange={(e) => setFormValues({ ...formValues, inCalc: e.target.checked ? "true" : "false" })} className="accent-green-400" />
              <span>Include in calculation</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => {
                if (formValues.date && formValues.category && formValues.amount) {
                  saveData({ ...data, transactions: [...data.transactions, { date: formValues.date, category: formValues.category, amount: parseInt(formValues.amount), source: formValues.source || defaultSource, note: formValues.note || "", inCalc: formValues.inCalc !== "false" }] });
                  closeForm();
                }
              }} className="text-blue-400">Save</button>
              <button onClick={closeForm} className="text-slate-500">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => startForm("transaction", { date: `${data.month}/${new Date().getDate()}`, source: defaultSource })} className="text-blue-400 text-xs">+ Add Transaction</button>
        )}
        <div className="text-slate-600 text-xs flex justify-between">
          <span>→ After Transactions:</span>
          <span>¥{actualRemaining.toLocaleString()}</span>
        </div>
        <Divider />

        <div className="flex justify-between text-yellow-400 font-bold">
          <span>Actual Remaining</span>
          <span className={actualRemaining < 0 ? "text-red-400" : ""}>¥{actualRemaining.toLocaleString()}</span>
        </div>
        {selectedAccounts.map((acc) => {
          const r = calcRemainingBySource(acc.name);
          return (
            <div key={acc.name} className="text-slate-500 text-xs flex justify-between">
              <span>  {acc.name}</span>
              <span className={r.actual < 0 ? "text-red-400" : ""}>¥{r.actual.toLocaleString()}</span>
            </div>
          );
        })}
        {selectedCash.length > 0 && (
          <div className="text-slate-500 text-xs flex justify-between">
            <span>  Cash</span>
            <span className={calcRemainingBySource("Cash").actual < 0 ? "text-red-400" : ""}>¥{calcRemainingBySource("Cash").actual.toLocaleString()}</span>
          </div>
        )}
        <Divider />

        <div className="flex justify-between text-yellow-400 font-bold">
          <span>Suica:</span>
          <EditableNumber value={data.suica} onChange={(v) => saveData({ ...data, suica: v })} />
        </div>
        <div className="text-slate-500 text-xs">Charge when below ¥3,000</div>
        <Divider />

        <div className="text-center text-slate-600 text-xs mt-4">
          {isSaving ? "Saving..." : lastSaved ? `Saved: ${lastSaved.toLocaleTimeString()}` : ""}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="text-slate-700">--------------------------------------------</div>;
}

function EditableNumber({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  if (isEditing) {
    return (
      <input
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          onChange(parseInt(editValue) || 0);
          setIsEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(parseInt(editValue) || 0);
            setIsEditing(false);
          }
        }}
        className="bg-slate-800 text-green-400 w-24 px-1 border border-green-600 outline-none"
        autoFocus
      />
    );
  }

  return (
    <span
      onClick={() => {
        setEditValue(String(value));
        setIsEditing(true);
      }}
      className="cursor-pointer hover:bg-slate-800 px-1"
    >
      ¥{value.toLocaleString()}
    </span>
  );
}

const CASH_LOCATIONS = ["Paul Smith", "Kikuchi Takeo", "envelope"] as const;

function CashSection({
  data,
  saveData,
  editingField,
  formValues,
  setFormValues,
  startForm,
  closeForm,
}: {
  data: Data;
  saveData: (d: Data) => void;
  editingField: string | null;
  formValues: Record<string, string>;
  setFormValues: (v: Record<string, string>) => void;
  startForm: (field: string, initial?: Record<string, string>) => void;
  closeForm: () => void;
}) {
  const getCash = (location: string) => data.cash.find((c) => c.location === location) || { location, yen10000: 0, yen5000: 0, yen1000: 0, other: 0, inRemaining: true };

  const updateCash = (location: string, updates: Partial<CashLocation>) => {
    const existing = data.cash.find((c) => c.location === location);
    if (existing) {
      const newCash = data.cash.map((c) => c.location === location ? { ...c, ...updates } : c);
      saveData({ ...data, cash: newCash });
    } else {
      saveData({ ...data, cash: [...data.cash, { ...getCash(location), ...updates }] });
    }
  };

  return (
    <>
      <div>Cash:</div>
      {CASH_LOCATIONS.map((location) => {
        const c = getCash(location);
        const total = c.yen10000 * 10000 + c.yen5000 * 5000 + c.yen1000 * 1000 + c.other;
        return (
          <div key={location}>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={c.inRemaining !== false}
                  onChange={(e) => updateCash(location, { inRemaining: e.target.checked })}
                  className="accent-green-400"
                />
                {location} → ¥{total.toLocaleString()}
              </span>
              <button
                onClick={() => startForm(`cash-${location}`, {
                  yen10000: String(c.yen10000),
                  yen5000: String(c.yen5000),
                  yen1000: String(c.yen1000),
                  other: String(c.other),
                })}
                className="text-blue-400 text-xs"
              >Edit</button>
            </div>
            <div className="text-slate-500 text-xs ml-5">
              10000×{c.yen10000} / 5000×{c.yen5000} / 1000×{c.yen1000} / other: ¥{c.other}
            </div>
            {editingField === `cash-${location}` && (
              <div className="bg-slate-900 p-2 my-1 ml-5">
                <input placeholder="10000 bills" type="number" value={formValues.yen10000 || ""} onChange={(e) => setFormValues({ ...formValues, yen10000: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <input placeholder="5000 bills" type="number" value={formValues.yen5000 || ""} onChange={(e) => setFormValues({ ...formValues, yen5000: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <input placeholder="1000 bills" type="number" value={formValues.yen1000 || ""} onChange={(e) => setFormValues({ ...formValues, yen1000: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <input placeholder="Other" type="number" value={formValues.other || ""} onChange={(e) => setFormValues({ ...formValues, other: e.target.value })} className="bg-black text-green-400 border border-green-600 px-1 w-full mb-1" />
                <div className="flex gap-2">
                  <button onClick={() => {
                    updateCash(location, {
                      yen10000: parseInt(formValues.yen10000) || 0,
                      yen5000: parseInt(formValues.yen5000) || 0,
                      yen1000: parseInt(formValues.yen1000) || 0,
                      other: parseInt(formValues.other) || 0,
                    });
                    closeForm();
                  }} className="text-blue-400">Save</button>
                  <button onClick={closeForm} className="text-slate-500">Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
