"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

type FixedCost = {
  name: string;
  amount: number;
  day: number;
  note?: string;
};

type Account = {
  name: string;
  balance: number;
};

type CashLocation = {
  name: string;
  yen10000: number;
  yen5000: number;
  yen1000: number;
};

type Budget = {
  name: string;
  current: number;
  limit: number;
};

type ShoppingItem = {
  name: string;
  amount: number;
  date: string;
  subItems?: { name: string; amount: number }[];
  isFixedCost?: boolean;
};

type SavingsAccount = {
  name: string;
  balance: number;
};

type Data = {
  year: number;
  month: number;
  startDay: number;
  endDay: number;
  fixedCostMonth: number;
  fixedCosts: FixedCost[];
  fixedCostNote: string;
  income: number;
  incomeOther: number;
  savingsActual: number;
  savingsTarget: number;
  transferNote: string;
  accounts: Account[];
  cash: CashLocation[];
  budgets: Budget[];
  shoppingMonth: number;
  shoppingExtra: number;
  shopping: ShoppingItem[];
  reserveLimit: number;
  suica: number;
  suicaNote: string;
  savings: SavingsAccount[];
  images: string[];
  memo: string;
};

const now = new Date();
const defaultData: Data = {
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  startDay: 1,
  endDay: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
  fixedCostMonth: now.getMonth() + 1,
  fixedCosts: [],
  fixedCostNote: "",
  income: 0,
  incomeOther: 0,
  savingsActual: 0,
  savingsTarget: 0,
  transferNote: "",
  accounts: [],
  cash: [],
  budgets: [],
  shoppingMonth: now.getMonth() + 1,
  shoppingExtra: 0,
  shopping: [],
  reserveLimit: 0,
  suica: 0,
  suicaNote: "",
  savings: [],
  images: [],
  memo: "",
};

type SectionHistory = {
  past: Partial<Data>[];
  future: Partial<Data>[];
};

const allFields: (keyof Data)[] = [
  'year', 'month', 'startDay', 'endDay',
  'fixedCostMonth', 'fixedCosts', 'fixedCostNote',
  'income', 'incomeOther', 'savingsActual', 'savingsTarget', 'transferNote',
  'accounts', 'cash', 'budgets',
  'shoppingMonth', 'shoppingExtra', 'shopping',
  'reserveLimit', 'suica', 'suicaNote', 'savings', 'images', 'memo',
];

const sectionFields: Record<string, (keyof Data)[]> = {
  dateRange: ['year', 'month', 'startDay', 'endDay'],
  fixedCosts: ['fixedCostMonth', 'fixedCosts', 'fixedCostNote'],
  transfer: ['income', 'incomeOther', 'savingsActual', 'savingsTarget', 'transferNote'],
  accounts: ['accounts'],
  cash: ['cash'],
  budget: ['budgets'],
  shopping: ['shoppingMonth', 'shoppingExtra', 'shopping'],
  suica: ['suica', 'suicaNote'],
  savings: ['savings'],
  all: allFields,
};

const initHistory = (): Record<string, SectionHistory> => ({
  dateRange: { past: [], future: [] },
  fixedCosts: { past: [], future: [] },
  transfer: { past: [], future: [] },
  accounts: { past: [], future: [] },
  cash: { past: [], future: [] },
  budget: { past: [], future: [] },
  shopping: { past: [], future: [] },
  suica: { past: [], future: [] },
  savings: { past: [], future: [] },
  all: { past: [], future: [] },
});

export default function Home() {
  const [data, setData] = useState<Data>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"main" | "images" | "memo">("main");
  const [history, setHistory] = useState<Record<string, SectionHistory>>(initHistory);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabase();
      const { data: stored } = await supabase
        .from("money_data")
        .select("*")
        .single();

      if (stored?.data) {
        const loadedData = { ...defaultData, ...stored.data } as Data;
        if (loadedData.shopping) {
          loadedData.shopping = loadedData.shopping.map((item) => ({
            ...item,
            date: item.date.includes("/") ? item.date.split("/")[1] : item.date,
          })).sort((a, b) => parseInt(a.date) - parseInt(b.date));
        }
        setData(loadedData);
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

  const saveData = async (newData: Data, section?: string) => {
    if (section) {
      const fields = sectionFields[section];
      const currentSnapshot: Partial<Data> = {};
      fields.forEach(f => { (currentSnapshot as Record<string, unknown>)[f] = JSON.parse(JSON.stringify(data[f])); });

      setHistory(prev => ({
        ...prev,
        [section]: {
          past: [...prev[section].past.slice(-19), currentSnapshot],
          future: [],
        },
      }));
    }

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

  const undo = (section: string) => {
    const h = history[section];
    if (h.past.length === 0) return;

    const fields = sectionFields[section];
    const currentSnapshot: Partial<Data> = {};
    fields.forEach(f => { (currentSnapshot as Record<string, unknown>)[f] = JSON.parse(JSON.stringify(data[f])); });

    const prev = h.past[h.past.length - 1];
    const newData = { ...data, ...prev };

    setHistory(prevH => ({
      ...prevH,
      [section]: {
        past: prevH[section].past.slice(0, -1),
        future: [currentSnapshot, ...prevH[section].future],
      },
    }));

    setData(newData);
    setIsSaving(true);
    (async () => {
      try {
        await getSupabase().from("money_data").upsert({ id: 1, data: newData });
        setLastSaved(new Date());
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const redo = (section: string) => {
    const h = history[section];
    if (h.future.length === 0) return;

    const fields = sectionFields[section];
    const currentSnapshot: Partial<Data> = {};
    fields.forEach(f => { (currentSnapshot as Record<string, unknown>)[f] = JSON.parse(JSON.stringify(data[f])); });

    const next = h.future[0];
    const newData = { ...data, ...next };

    setHistory(prevH => ({
      ...prevH,
      [section]: {
        past: [...prevH[section].past, currentSnapshot],
        future: prevH[section].future.slice(1),
      },
    }));

    setData(newData);
    setIsSaving(true);
    (async () => {
      try {
        await getSupabase().from("money_data").upsert({ id: 1, data: newData });
        setLastSaved(new Date());
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const clearHistory = (section: string) => {
    setHistory(prev => ({
      ...prev,
      [section]: { past: [], future: [] },
    }));
  };

  const startForm = (field: string, initial: Record<string, string> = {}) => {
    setEditingField(field);
    setFormValues(initial);
  };

  const closeForm = () => {
    setEditingField(null);
    setFormValues({});
  };

  // Calculations
  const totalFixedCosts = (data.fixedCosts || []).reduce((sum, c) => sum + c.amount, 0);
  const totalIncome = (data.income || 0) + (data.incomeOther || 0);
  const transfer = totalIncome - (data.savingsActual || 0);
  const totalAccounts = (data.accounts || []).reduce((sum, a) => sum + a.balance, 0);
  const totalCash = (data.cash || []).reduce((sum, c) => sum + (c.yen10000 || 0) * 10000 + (c.yen5000 || 0) * 5000 + (c.yen1000 || 0) * 1000, 0);
  const totalBalance = totalAccounts + totalCash;
  const totalBudgets = (data.budgets || []).reduce((sum, b) => sum + (b.current || 0), 0);
  const totalShopping = (data.shopping || []).reduce((sum, s) => {
    const subTotal = s.subItems?.reduce((ss, si) => ss + si.amount, 0) || 0;
    return sum + s.amount + subTotal;
  }, 0);
  const remaining = totalBalance - totalBudgets - totalShopping;
  const totalSavings = (data.savings || []).reduce((sum, s) => sum + s.balance, 0);

  const daysInMonth = new Date(data.year, data.month, 0).getDate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black flex items-center justify-center">
        <div className="text-emerald-400 font-mono text-lg tracking-wider animate-pulse">Loading...</div>
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        saveData({ ...data, images: [...(data.images || []), base64] });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const deleteImage = (index: number) => {
    const newImages = (data.images || []).filter((_, i) => i !== index);
    saveData({ ...data, images: newImages });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-emerald-400 font-mono text-sm p-4 pb-24">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6 pt-2">
          <div className="inline-block">
            <h1 className="text-3xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-300">
              MONEY
            </h1>
            <h1 className="text-xl font-light tracking-[0.4em] text-emerald-500/70 -mt-1">
              TRACKER
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-slate-900/50 rounded-full p-1 border border-slate-800">
            {[
              { id: "main", label: "Dashboard" },
              { id: "memo", label: "Memo" },
              { id: "images", label: "Images" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "memo" ? (
          <div className="animate-fadeIn">
            <SectionCard title="MEMO" icon="pencil">
              <textarea
                value={data.memo || ""}
                onChange={(e) => saveData({ ...data, memo: e.target.value })}
                placeholder="Write anything here..."
                className="w-full h-[60vh] bg-slate-900/30 text-emerald-300 border border-slate-800 rounded-xl p-4 text-sm resize-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-600/30 outline-none placeholder-slate-600"
              />
            </SectionCard>
          </div>
        ) : activeTab === "images" ? (
          <div className="animate-fadeIn">
            <SectionCard title="IMAGES" icon="camera">
              <label
                className="block mb-4"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.querySelector("div")?.classList.add("border-emerald-500", "bg-emerald-500/10");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.querySelector("div")?.classList.remove("border-emerald-500", "bg-emerald-500/10");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.querySelector("div")?.classList.remove("border-emerald-500", "bg-emerald-500/10");
                  const files = e.dataTransfer.files;
                  if (files) {
                    Array.from(files).forEach((file) => {
                      if (file.type.startsWith("image/")) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64 = reader.result as string;
                          saveData({ ...data, images: [...(data.images || []), base64] });
                        };
                        reader.readAsDataURL(file);
                      }
                    });
                  }
                }}
              >
                <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-600/50 transition-all duration-200">
                  <div className="text-slate-500 text-sm mb-1">Drop images here or click to upload</div>
                  <div className="text-slate-600 text-xs">PNG, JPG, GIF supported</div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </label>
              {(data.images || []).length === 0 ? (
                <div className="text-slate-600 text-xs text-center py-12">No images uploaded yet</div>
              ) : (
                <div className="space-y-4">
                  {(data.images || []).map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img} alt={`Upload ${i + 1}`} className="w-full rounded-xl border border-slate-800 shadow-xl" />
                      <button
                        onClick={() => deleteImage(i)}
                        className="absolute top-3 right-3 bg-red-500/90 hover:bg-red-500 active:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        ) : (
          <div className="space-y-4 animate-fadeIn">
            {/* Date Range */}
            <SectionCard title="DATE RANGE" icon="calendar" compact
              onUndo={() => undo("dateRange")}
              onRedo={() => redo("dateRange")}
              onSave={() => clearHistory("dateRange")}
              canUndo={history.dateRange.past.length > 0}
              canRedo={history.dateRange.future.length > 0}
            >
              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg px-3 py-2">
                  <MonthSelect value={data.month} onChange={(m) => saveData({ ...data, month: m }, "dateRange")} />
                  <span className="text-slate-500">/</span>
                  <DaySelect value={data.startDay || 1} max={daysInMonth} onChange={(d) => saveData({ ...data, startDay: d }, "dateRange")} />
                </div>
                <span className="text-slate-600">to</span>
                <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg px-3 py-2">
                  <MonthSelect value={data.month} onChange={(m) => saveData({ ...data, month: m }, "dateRange")} />
                  <span className="text-slate-500">/</span>
                  <DaySelect value={data.endDay || daysInMonth} max={daysInMonth} onChange={(d) => saveData({ ...data, endDay: d }, "dateRange")} />
                </div>
              </div>
            </SectionCard>

            {/* Fixed Costs - Info section */}
            <SectionCard title="FIXED COSTS" subtitle="Monthly recurring" icon="repeat" color="blue"
              onUndo={() => undo("fixedCosts")}
              onRedo={() => redo("fixedCosts")}
              onSave={() => clearHistory("fixedCosts")}
              canUndo={history.fixedCosts.past.length > 0}
              canRedo={history.fixedCosts.future.length > 0}
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">Month:</span>
                  <MonthSelect value={data.fixedCostMonth} onChange={(m) => saveData({ ...data, fixedCostMonth: m }, "fixedCosts")} />
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Total</div>
                  <div className="text-lg font-bold text-blue-400">¥{totalFixedCosts.toLocaleString()}</div>
                </div>
              </div>
              <div className="space-y-1">
                {(data.fixedCosts || []).map((cost, i) => (
                  <div key={i} className="group">
                    <div className="flex justify-between items-center py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-800/30 active:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-xs w-8">{cost.day}日</span>
                        <span className="text-slate-200">{cost.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-medium">¥{cost.amount.toLocaleString()}</span>
                        <div className="flex gap-1">
                          <ActionBtn color="purple" onClick={() => {
                            const newShoppingItem: ShoppingItem = { name: cost.name, amount: cost.amount, date: String(cost.day) };
                            const newShopping = [...(data.shopping || []), newShoppingItem].sort((a, b) => parseInt(a.date) - parseInt(b.date));
                            saveData({ ...data, shopping: newShopping }, "shopping");
                          }}>shop</ActionBtn>
                          <ActionBtn color="blue" onClick={() => startForm(`fixed-edit-${i}`, { name: cost.name, amount: String(cost.amount), day: String(cost.day), note: cost.note || "" })}>edit</ActionBtn>
                          <ActionBtn color="red" onClick={() => saveData({ ...data, fixedCosts: data.fixedCosts.filter((_, idx) => idx !== i) }, "fixedCosts")}>del</ActionBtn>
                        </div>
                      </div>
                    </div>
                    {cost.note && <div className="text-slate-400 text-xs ml-12 -mt-1 mb-1">{cost.note}</div>}
                  </div>
                ))}
              </div>
              {editingField?.startsWith("fixed-edit-") && (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[
                    { key: "name", placeholder: "Name" },
                    { key: "amount", placeholder: "Amount", type: "number" },
                    { key: "day", placeholder: "Day (1-31)", type: "number" },
                    { key: "note", placeholder: "Note (optional)" },
                  ]}
                  onSave={() => {
                    const i = parseInt(editingField.split("-")[2]);
                    if (formValues.name && formValues.amount && formValues.day) {
                      const newCosts = [...data.fixedCosts];
                      newCosts[i] = { name: formValues.name, amount: parseInt(formValues.amount), day: parseInt(formValues.day), note: formValues.note || "" };
                      saveData({ ...data, fixedCosts: newCosts.sort((a, b) => a.day - b.day) }, "fixedCosts");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              )}
              {editingField === "fixed-add" ? (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[
                    { key: "name", placeholder: "Name" },
                    { key: "amount", placeholder: "Amount", type: "number" },
                    { key: "day", placeholder: "Day (1-31)", type: "number" },
                    { key: "note", placeholder: "Note (optional)" },
                  ]}
                  onSave={() => {
                    if (formValues.name && formValues.amount && formValues.day) {
                      const newFixedCost = { name: formValues.name, amount: parseInt(formValues.amount), day: parseInt(formValues.day), note: formValues.note || "" };
                      saveData({ ...data, fixedCosts: [...(data.fixedCosts || []), newFixedCost].sort((a, b) => a.day - b.day) }, "fixedCosts");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              ) : (
                <AddButton onClick={() => startForm("fixed-add")} />
              )}
              <NoteInput value={data.fixedCostNote || ""} onChange={(v) => saveData({ ...data, fixedCostNote: v }, "fixedCosts")} placeholder="Section note..." />
            </SectionCard>

            {/* Transfer - Info section */}
            <SectionCard title="TRANSFER" subtitle="Income allocation" icon="arrow-right" color="cyan"
              onReset={() => {
                saveData({ ...data, income: 0, incomeOther: 0, savingsActual: data.savingsTarget || 0, transferNote: "" }, "transfer");
              }}
              onUndo={() => undo("transfer")}
              onRedo={() => redo("transfer")}
              onSave={() => clearHistory("transfer")}
              canUndo={history.transfer.past.length > 0}
              canRedo={history.transfer.future.length > 0}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-300">Net Income</span>
                  <EditableNumber value={data.income} onChange={(v) => saveData({ ...data, income: v }, "transfer")} />
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-300">Others</span>
                  <EditableNumber value={data.incomeOther || 0} onChange={(v) => saveData({ ...data, incomeOther: v }, "transfer")} />
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-xs">Total Income</span>
                  <span className="text-slate-200">¥{totalIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-300">Savings</span>
                  <div className="flex items-center gap-2">
                    <EditableNumber value={data.savingsActual || 0} onChange={(v) => saveData({ ...data, savingsActual: v }, "transfer")} />
                    <span className="text-slate-500">/</span>
                    <span className="text-slate-400">¥{(data.savingsTarget || 0).toLocaleString()}</span>
                    <button onClick={() => startForm("savings-target", { target: String(data.savingsTarget || 0) })} className="text-blue-400 hover:text-blue-300 active:text-blue-200 text-xs px-2 py-1">edit</button>
                  </div>
                </div>
                {editingField === "savings-target" && (
                  <EditForm formValues={formValues} setFormValues={setFormValues}
                    fields={[{ key: "target", placeholder: "Target amount", type: "number" }]}
                    onSave={() => { saveData({ ...data, savingsTarget: parseInt(formValues.target) || 0 }, "transfer"); closeForm(); }}
                    onCancel={closeForm}
                  />
                )}
                <NoteInput value={data.transferNote || ""} onChange={(v) => saveData({ ...data, transferNote: v }, "transfer")} placeholder="Note..." />
                <div className="pt-3 mt-3 border-t border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Transfer Amount</span>
                    <span className="text-xl font-bold text-cyan-400">¥{transfer.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Divider */}
            <div className="py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
                <span className="text-xs text-slate-600 tracking-widest">EDITABLE</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
              </div>
            </div>

            {/* Bank Accounts */}
            <SectionCard title="BANK ACCOUNTS" icon="bank" color="emerald"
              onUndo={() => undo("accounts")}
              onRedo={() => redo("accounts")}
              onSave={() => clearHistory("accounts")}
              canUndo={history.accounts.past.length > 0}
              canRedo={history.accounts.future.length > 0}
            >
              <div className="space-y-2">
                {(data.accounts || []).map((acc, i) => (
                  <div key={i} className="flex justify-between items-center py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-800/30 active:bg-slate-800/50 transition-colors group">
                    <span className="text-slate-200">{acc.name}</span>
                    <div className="flex items-center gap-2">
                      <EditableNumber value={acc.balance} onChange={(v) => {
                        const newAccounts = [...data.accounts];
                        newAccounts[i] = { ...acc, balance: v };
                        saveData({ ...data, accounts: newAccounts }, "accounts");
                      }} />
                      <div className="flex gap-1">
                        <ActionBtn color="blue" onClick={() => startForm(`account-edit-${i}`, { name: acc.name })}>edit</ActionBtn>
                        <ActionBtn color="red" onClick={() => saveData({ ...data, accounts: data.accounts.filter((_, idx) => idx !== i) }, "accounts")}>del</ActionBtn>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {editingField?.startsWith("account-edit-") && (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[{ key: "name", placeholder: "Account name" }]}
                  onSave={() => {
                    const i = parseInt(editingField.split("-")[2]);
                    if (formValues.name) {
                      const newAccounts = [...data.accounts];
                      newAccounts[i] = { ...newAccounts[i], name: formValues.name };
                      saveData({ ...data, accounts: newAccounts }, "accounts");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              )}
              {editingField === "account-add" ? (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[{ key: "name", placeholder: "Account name" }]}
                  onSave={() => {
                    if (formValues.name) {
                      saveData({ ...data, accounts: [...(data.accounts || []), { name: formValues.name, balance: 0 }] }, "accounts");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              ) : (
                <AddButton onClick={() => startForm("account-add")} />
              )}
              <Subtotal label="Subtotal" value={totalAccounts} />
            </SectionCard>

            {/* Cash */}
            <SectionCard title="CASH" icon="wallet" color="emerald"
              onUndo={() => undo("cash")}
              onRedo={() => redo("cash")}
              onSave={() => clearHistory("cash")}
              canUndo={history.cash.past.length > 0}
              canRedo={history.cash.future.length > 0}
            >
              <div className="space-y-3">
                {(data.cash || []).map((c, i) => {
                  const total = (c.yen10000 || 0) * 10000 + (c.yen5000 || 0) * 5000 + (c.yen1000 || 0) * 1000;
                  return (
                    <div key={i} className="group">
                      <div className="flex justify-between items-center py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-800/30 active:bg-slate-800/50 transition-colors">
                        <span className="text-slate-200">{c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-medium">¥{total.toLocaleString()}</span>
                          <div className="flex gap-1">
                            <ActionBtn color="blue" onClick={() => startForm(`cash-edit-${i}`, {
                              name: c.name,
                              yen10000: String(c.yen10000 || 0),
                              yen5000: String(c.yen5000 || 0),
                              yen1000: String(c.yen1000 || 0)
                            })}>edit</ActionBtn>
                            <ActionBtn color="red" onClick={() => saveData({ ...data, cash: data.cash.filter((_, idx) => idx !== i) }, "cash")}>del</ActionBtn>
                          </div>
                        </div>
                      </div>
                      <div className="text-slate-500 text-xs ml-2 flex gap-3">
                        <span>10k x{c.yen10000 || 0}</span>
                        <span>5k x{c.yen5000 || 0}</span>
                        <span>1k x{c.yen1000 || 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {editingField?.startsWith("cash-edit-") && (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[
                    { key: "name", placeholder: "Location" },
                    { key: "yen10000", placeholder: "10,000 bills", type: "number" },
                    { key: "yen5000", placeholder: "5,000 bills", type: "number" },
                    { key: "yen1000", placeholder: "1,000 bills", type: "number" },
                  ]}
                  onSave={() => {
                    const i = parseInt(editingField.split("-")[2]);
                    if (formValues.name) {
                      const newCash = [...data.cash];
                      newCash[i] = { name: formValues.name, yen10000: parseInt(formValues.yen10000) || 0, yen5000: parseInt(formValues.yen5000) || 0, yen1000: parseInt(formValues.yen1000) || 0 };
                      saveData({ ...data, cash: newCash }, "cash");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              )}
              {editingField === "cash-add" ? (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[
                    { key: "name", placeholder: "Location" },
                    { key: "yen10000", placeholder: "10,000 bills", type: "number" },
                    { key: "yen5000", placeholder: "5,000 bills", type: "number" },
                    { key: "yen1000", placeholder: "1,000 bills", type: "number" },
                  ]}
                  onSave={() => {
                    if (formValues.name) {
                      saveData({ ...data, cash: [...(data.cash || []), { name: formValues.name, yen10000: parseInt(formValues.yen10000) || 0, yen5000: parseInt(formValues.yen5000) || 0, yen1000: parseInt(formValues.yen1000) || 0 }] }, "cash");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              ) : (
                <AddButton onClick={() => startForm("cash-add")} />
              )}
              <Subtotal label="Subtotal" value={totalCash} />
            </SectionCard>

            {/* Total Balance - Highlight */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900/40 via-emerald-800/20 to-transparent border border-emerald-700/30 p-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
              <div className="relative flex justify-between items-center">
                <div>
                  <div className="text-emerald-400/70 text-xs font-medium tracking-wider mb-1">TOTAL BALANCE</div>
                  <div className="text-slate-400 text-xs">Accounts + Cash</div>
                </div>
                <div className="text-3xl font-bold text-emerald-300">¥{totalBalance.toLocaleString()}</div>
              </div>
            </div>

            {/* Budget */}
            <SectionCard title="BUDGET" icon="pie-chart" color="amber"
              onReset={() => {
                saveData({ ...data, budgets: (data.budgets || []).map(b => ({ ...b, current: b.limit })) }, "budget");
              }}
              onUndo={() => undo("budget")}
              onRedo={() => redo("budget")}
              onSave={() => clearHistory("budget")}
              canUndo={history.budget.past.length > 0}
              canRedo={history.budget.future.length > 0}
            >
              <div className="space-y-2">
                {(data.budgets || []).map((b, i) => {
                  const percentage = b.limit > 0 ? Math.min((b.current / b.limit) * 100, 100) : 0;
                  const isOver = b.current > b.limit;
                  return (
                    <div key={i} className="group">
                      <div className="flex justify-between items-center py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-800/30 active:bg-slate-800/50 transition-colors">
                        <span className="text-slate-200">{b.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={isOver ? "text-red-400 font-medium" : "text-amber-400 font-medium"}>
                            ¥{(b.current || 0).toLocaleString()}
                          </span>
                          <span className="text-slate-500">/</span>
                          <span className="text-slate-400">¥{(b.limit || 0).toLocaleString()}</span>
                          <div className="flex gap-1">
                            <ActionBtn color="blue" onClick={() => startForm(`budget-edit-${i}`, { name: b.name, current: String(b.current || 0), limit: String(b.limit || 0) })}>edit</ActionBtn>
                            <ActionBtn color="red" onClick={() => saveData({ ...data, budgets: data.budgets.filter((_, idx) => idx !== i) }, "budget")}>del</ActionBtn>
                          </div>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mx-2">
                        <div className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {editingField?.startsWith("budget-edit-") && (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[
                    { key: "name", placeholder: "Category" },
                    { key: "current", placeholder: "Current", type: "number" },
                    { key: "limit", placeholder: "Limit", type: "number" },
                  ]}
                  onSave={() => {
                    const i = parseInt(editingField.split("-")[2]);
                    if (formValues.name) {
                      const newBudgets = [...data.budgets];
                      newBudgets[i] = { name: formValues.name, current: parseInt(formValues.current) || 0, limit: parseInt(formValues.limit) || 0 };
                      saveData({ ...data, budgets: newBudgets }, "budget");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              )}
              {editingField === "budget-add" ? (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[
                    { key: "name", placeholder: "Category" },
                    { key: "current", placeholder: "Current", type: "number" },
                    { key: "limit", placeholder: "Limit", type: "number" },
                  ]}
                  onSave={() => {
                    if (formValues.name) {
                      saveData({ ...data, budgets: [...(data.budgets || []), { name: formValues.name, current: parseInt(formValues.current) || 0, limit: parseInt(formValues.limit) || 0 }] }, "budget");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              ) : (
                <AddButton onClick={() => startForm("budget-add")} />
              )}
              <Subtotal label="Total Budget" value={totalBudgets} />
            </SectionCard>

            {/* Shopping List */}
            <SectionCard title="SHOPPING LIST" icon="cart" color="violet"
              onUndo={() => undo("shopping")}
              onRedo={() => redo("shopping")}
              onSave={() => clearHistory("shopping")}
              canUndo={history.shopping.past.length > 0}
              canRedo={history.shopping.future.length > 0}
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <MonthSelect value={data.shoppingMonth || data.month} onChange={(m) => saveData({ ...data, shoppingMonth: m }, "shopping")} />
                </div>
                <div className="text-right text-xs">
                  <span className="text-violet-400 font-medium">¥{totalShopping.toLocaleString()}</span>
                  <span className="text-slate-600"> / ¥{totalFixedCosts.toLocaleString()} + </span>
                  <EditableNumber value={data.shoppingExtra || 0} onChange={(v) => saveData({ ...data, shoppingExtra: v }, "shopping")} />
                </div>
              </div>
              <div className="space-y-1">
                {(data.shopping || []).map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-800/30 active:bg-slate-800/50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-xs w-6">{item.date}日</span>
                        <span className="text-slate-200">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-violet-400 font-medium">¥{item.amount.toLocaleString()}</span>
                        <div className="flex gap-1">
                          <ActionBtn color="blue" onClick={() => startForm(`shopping-edit-${i}`, { name: item.name, amount: String(item.amount), date: item.date })}>edit</ActionBtn>
                          <ActionBtn color="purple" onClick={() => startForm(`shopping-sub-${i}`)}>+sub</ActionBtn>
                          <ActionBtn color="red" onClick={() => saveData({ ...data, shopping: data.shopping.filter((_, idx) => idx !== i) }, "shopping")}>del</ActionBtn>
                        </div>
                      </div>
                    </div>
                    {item.subItems?.map((sub, si) => (
                      <div key={si} className="flex justify-between items-center py-1.5 ml-8 text-xs group">
                        <span className="text-slate-400">+ {sub.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300">¥{sub.amount.toLocaleString()}</span>
                          <div className="flex gap-1">
                            <ActionBtn color="blue" onClick={() => startForm(`shopping-sub-edit-${i}-${si}`, { name: sub.name, amount: String(sub.amount) })}>edit</ActionBtn>
                            <ActionBtn color="red" onClick={() => {
                              const newShopping = [...data.shopping];
                              newShopping[i] = { ...newShopping[i], subItems: newShopping[i].subItems?.filter((_, idx) => idx !== si) };
                              saveData({ ...data, shopping: newShopping }, "shopping");
                            }}>del</ActionBtn>
                          </div>
                        </div>
                      </div>
                    ))}
                    {editingField === `shopping-sub-${i}` && (
                      <div className="ml-8">
                        <EditForm formValues={formValues} setFormValues={setFormValues}
                          fields={[{ key: "name", placeholder: "Sub item" }, { key: "amount", placeholder: "Amount", type: "number" }]}
                          onSave={() => {
                            if (formValues.name && formValues.amount) {
                              const newShopping = [...data.shopping];
                              const subItems = newShopping[i].subItems || [];
                              newShopping[i] = { ...newShopping[i], subItems: [...subItems, { name: formValues.name, amount: parseInt(formValues.amount) }] };
                              saveData({ ...data, shopping: newShopping }, "shopping");
                              closeForm();
                            }
                          }}
                          onCancel={closeForm}
                        />
                      </div>
                    )}
                    {editingField?.startsWith(`shopping-sub-edit-${i}-`) && (
                      <div className="ml-8">
                        <EditForm formValues={formValues} setFormValues={setFormValues}
                          fields={[{ key: "name", placeholder: "Sub item" }, { key: "amount", placeholder: "Amount", type: "number" }]}
                          onSave={() => {
                            const si = parseInt(editingField.split("-")[4]);
                            if (formValues.name && formValues.amount) {
                              const newShopping = [...data.shopping];
                              const subItems = [...(newShopping[i].subItems || [])];
                              subItems[si] = { name: formValues.name, amount: parseInt(formValues.amount) };
                              newShopping[i] = { ...newShopping[i], subItems };
                              saveData({ ...data, shopping: newShopping }, "shopping");
                              closeForm();
                            }
                          }}
                          onCancel={closeForm}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {editingField?.startsWith("shopping-edit-") && !editingField.includes("sub") && (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[{ key: "name", placeholder: "Item" }, { key: "amount", placeholder: "Amount", type: "number" }, { key: "date", placeholder: "Day (1-31)", type: "number" }]}
                  onSave={() => {
                    const i = parseInt(editingField.split("-")[2]);
                    if (formValues.name && formValues.amount && formValues.date) {
                      const newShopping = [...data.shopping];
                      newShopping[i] = { ...newShopping[i], name: formValues.name, amount: parseInt(formValues.amount), date: formValues.date };
                      newShopping.sort((a, b) => parseInt(a.date) - parseInt(b.date));
                      saveData({ ...data, shopping: newShopping }, "shopping");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              )}
              {editingField === "shopping-add" ? (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[{ key: "name", placeholder: "Item" }, { key: "amount", placeholder: "Amount", type: "number" }, { key: "date", placeholder: "Day (1-31)", type: "number" }]}
                  onSave={() => {
                    if (formValues.name && formValues.amount && formValues.date) {
                      const newShopping = [...(data.shopping || []), { name: formValues.name, amount: parseInt(formValues.amount), date: formValues.date }];
                      newShopping.sort((a, b) => parseInt(a.date) - parseInt(b.date));
                      saveData({ ...data, shopping: newShopping }, "shopping");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              ) : (
                <AddButton onClick={() => startForm("shopping-add")} />
              )}
            </SectionCard>

            {/* Reserve - Important */}
            <div className={`relative overflow-hidden rounded-2xl p-5 border ${remaining < 0 ? "bg-gradient-to-br from-red-900/30 to-transparent border-red-700/30" : "bg-gradient-to-br from-yellow-900/30 to-transparent border-yellow-700/30"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className={`text-xs font-medium tracking-wider mb-1 ${remaining < 0 ? "text-red-400/70" : "text-yellow-400/70"}`}>RESERVE</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-slate-500 text-xs">Target:</span>
                    <EditableNumber value={data.reserveLimit || 0} onChange={(v) => saveData({ ...data, reserveLimit: v })} />
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${remaining < 0 ? "text-red-400" : "text-yellow-300"}`}>
                    ¥{remaining.toLocaleString()}
                  </div>
                  <div className="text-slate-500 text-xs mt-1">Balance - Budget - Shopping</div>
                </div>
              </div>
            </div>

            {/* Suica */}
            <SectionCard title="SUICA" icon="credit-card" color="green" compact
              onUndo={() => undo("suica")}
              onRedo={() => redo("suica")}
              onSave={() => clearHistory("suica")}
              canUndo={history.suica.past.length > 0}
              canRedo={history.suica.future.length > 0}
            >
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-300">Balance</span>
                <EditableNumber value={data.suica} onChange={(v) => saveData({ ...data, suica: v }, "suica")} />
              </div>
              <NoteInput value={data.suicaNote || ""} onChange={(v) => saveData({ ...data, suicaNote: v }, "suica")} placeholder="Note..." />
            </SectionCard>

            {/* Savings */}
            <SectionCard title="SAVINGS" icon="piggy-bank" color="pink"
              onUndo={() => undo("savings")}
              onRedo={() => redo("savings")}
              onSave={() => clearHistory("savings")}
              canUndo={history.savings.past.length > 0}
              canRedo={history.savings.future.length > 0}
            >
              <div className="space-y-2">
                {(data.savings || []).map((s, i) => (
                  <div key={i} className="flex justify-between items-center py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-800/30 active:bg-slate-800/50 transition-colors group">
                    <span className="text-slate-200">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <EditableNumber value={s.balance} onChange={(v) => {
                        const newSavings = [...data.savings];
                        newSavings[i] = { ...s, balance: v };
                        saveData({ ...data, savings: newSavings }, "savings");
                      }} />
                      <div className="flex gap-1">
                        <ActionBtn color="blue" onClick={() => startForm(`savings-edit-${i}`, { name: s.name })}>edit</ActionBtn>
                        <ActionBtn color="red" onClick={() => saveData({ ...data, savings: data.savings.filter((_, idx) => idx !== i) }, "savings")}>del</ActionBtn>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {editingField?.startsWith("savings-edit-") && (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[{ key: "name", placeholder: "Account name" }]}
                  onSave={() => {
                    const i = parseInt(editingField.split("-")[2]);
                    if (formValues.name) {
                      const newSavings = [...data.savings];
                      newSavings[i] = { ...newSavings[i], name: formValues.name };
                      saveData({ ...data, savings: newSavings }, "savings");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              )}
              {editingField === "savings-add" ? (
                <EditForm formValues={formValues} setFormValues={setFormValues}
                  fields={[{ key: "name", placeholder: "Account name" }]}
                  onSave={() => {
                    if (formValues.name) {
                      saveData({ ...data, savings: [...(data.savings || []), { name: formValues.name, balance: 0 }] }, "savings");
                      closeForm();
                    }
                  }}
                  onCancel={closeForm}
                />
              ) : (
                <AddButton onClick={() => startForm("savings-add")} />
              )}
              <Subtotal label="Total Savings" value={totalSavings} color="pink" />
            </SectionCard>

            {/* Footer */}
            <div className="pt-8 pb-4">
              <div className="text-center text-slate-600 text-xs mb-6">
                {isSaving ? (
                  <span className="text-emerald-500">Saving...</span>
                ) : lastSaved ? (
                  `Last saved: ${lastSaved.toLocaleTimeString()}`
                ) : (
                  ""
                )}
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => undo("all")}
                    disabled={history.all.past.length === 0}
                    className={`text-xs px-2 py-1 rounded transition-colors ${history.all.past.length > 0 ? "text-slate-500 hover:text-slate-300" : "text-slate-700 cursor-not-allowed"}`}
                  >
                    undo
                  </button>
                  <button
                    onClick={() => redo("all")}
                    disabled={history.all.future.length === 0}
                    className={`text-xs px-2 py-1 rounded transition-colors ${history.all.future.length > 0 ? "text-slate-500 hover:text-slate-300" : "text-slate-700 cursor-not-allowed"}`}
                  >
                    redo
                  </button>
                  <button
                    onClick={() => clearHistory("all")}
                    disabled={history.all.past.length === 0 && history.all.future.length === 0}
                    className={`text-xs px-2 py-1 rounded transition-colors ${(history.all.past.length > 0 || history.all.future.length > 0) ? "text-emerald-500 hover:text-emerald-400" : "text-slate-700 cursor-not-allowed"}`}
                  >
                    save
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Reset all data? This cannot be undone.")) {
                      saveData(defaultData, "all");
                    }
                  }}
                  className="text-red-500/70 hover:text-red-400 text-xs border border-red-900/50 hover:border-red-700/50 px-6 py-2.5 rounded-xl transition-all hover:bg-red-900/20"
                >
                  Reset All Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Components
function SectionCard({ title, subtitle, icon, color = "slate", compact, onReset, onUndo, onRedo, onSave, canUndo, canRedo, children }: {
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  compact?: boolean;
  onReset?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    slate: "from-slate-800/50",
    blue: "from-blue-900/30",
    cyan: "from-cyan-900/30",
    emerald: "from-emerald-900/30",
    amber: "from-amber-900/30",
    violet: "from-violet-900/30",
    green: "from-green-900/30",
    pink: "from-pink-900/30",
  };
  const textColorMap: Record<string, string> = {
    slate: "text-slate-400",
    blue: "text-blue-400",
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    violet: "text-violet-400",
    green: "text-green-400",
    pink: "text-pink-400",
  };

  const hasHistory = canUndo || canRedo;

  return (
    <div className={`rounded-2xl bg-gradient-to-b ${colorMap[color]} to-transparent border border-slate-800/50 ${compact ? "p-4" : "p-5"}`}>
      <div className={`flex items-center justify-between ${compact ? "mb-3" : "mb-4"}`}>
        <div className="flex items-center gap-2">
          <h2 className={`font-bold tracking-wider text-xs ${textColorMap[color]}`}>{title}</h2>
          {subtitle && <span className="text-slate-600 text-xs">/ {subtitle}</span>}
        </div>
        <div className="flex items-center gap-1">
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${canUndo ? "text-slate-500 hover:text-slate-300" : "text-slate-700 cursor-not-allowed"}`}
            >
              undo
            </button>
          )}
          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${canRedo ? "text-slate-500 hover:text-slate-300" : "text-slate-700 cursor-not-allowed"}`}
            >
              redo
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              disabled={!hasHistory}
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${hasHistory ? "text-emerald-500 hover:text-emerald-400" : "text-slate-700 cursor-not-allowed"}`}
            >
              save
            </button>
          )}
          {onReset && (
            <button
              onClick={() => {
                if (confirm(`Reset ${title}?`)) {
                  onReset();
                }
              }}
              className="text-slate-600 hover:text-red-400 text-xs px-1.5 py-0.5 rounded transition-colors"
            >
              reset
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function MonthSelect({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="bg-slate-800/50 text-emerald-400 border border-slate-700 rounded-lg px-2 py-1 text-xs focus:border-emerald-600 outline-none cursor-pointer"
    >
      {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
        <option key={m} value={m}>{m}月</option>
      ))}
    </select>
  );
}

function DaySelect({ value, max, onChange }: { value: number; max: number; onChange: (d: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="bg-slate-800/50 text-emerald-400 border border-slate-700 rounded-lg px-2 py-1 text-xs focus:border-emerald-600 outline-none cursor-pointer"
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  );
}

function ActionBtn({ children, color, onClick }: { children: React.ReactNode; color: string; onClick: () => void }) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400 hover:text-blue-300 active:text-blue-200 hover:bg-blue-500/10 active:bg-blue-500/20",
    red: "text-red-400 hover:text-red-300 active:text-red-200 hover:bg-red-500/10 active:bg-red-500/20",
    purple: "text-purple-400 hover:text-purple-300 active:text-purple-200 hover:bg-purple-500/10 active:bg-purple-500/20",
  };
  return (
    <button onClick={onClick} className={`text-xs px-2 py-1 rounded-md transition-colors ${colorMap[color]}`}>
      {children}
    </button>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-emerald-500 hover:text-emerald-400 text-xs mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors"
    >
      <span className="text-lg leading-none">+</span> Add
    </button>
  );
}

function NoteInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="mt-3 pt-3 border-t border-slate-800/50">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-slate-400 text-xs w-full focus:text-slate-300 outline-none placeholder-slate-600 py-1"
        placeholder={placeholder || "Note..."}
      />
    </div>
  );
}

function Subtotal({ label, value, color = "slate" }: { label: string; value: number; color?: string }) {
  const textColorMap: Record<string, string> = {
    slate: "text-slate-300",
    pink: "text-pink-400",
  };
  return (
    <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-800/50">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`font-medium ${textColorMap[color]}`}>¥{value.toLocaleString()}</span>
    </div>
  );
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
        className="bg-slate-800 text-emerald-400 w-28 px-3 py-1 border border-emerald-600/50 rounded-lg outline-none text-right text-sm"
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
      className="cursor-pointer hover:bg-slate-800/50 px-2 py-1 rounded-lg transition-colors text-emerald-400"
    >
      ¥{value.toLocaleString()}
    </span>
  );
}

function EditForm({
  formValues,
  setFormValues,
  fields,
  onSave,
  onCancel,
}: {
  formValues: Record<string, string>;
  setFormValues: (v: Record<string, string>) => void;
  fields: { key: string; placeholder: string; type?: string }[];
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-xl p-4 my-3 shadow-xl">
      <div className="space-y-2">
        {fields.map((f) => (
          <input
            key={f.key}
            placeholder={f.placeholder}
            type={f.type || "text"}
            value={formValues[f.key] || ""}
            onChange={(e) => setFormValues({ ...formValues, [f.key]: e.target.value })}
            className="bg-slate-800/50 text-emerald-400 border border-slate-700 rounded-lg px-3 py-2 w-full text-sm focus:border-emerald-600/50 outline-none placeholder-slate-600"
          />
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-lg shadow-emerald-600/20">
          Save
        </button>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 px-4 py-1.5 text-xs transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
