import { useState, useRef } from "react";
import { Plus, Eye, EyeOff, Pencil, GripVertical } from "lucide-react";
import type { UserCategory, UserCreditCard, UserDashboardField } from "@/hooks/useUserSettings";
import ConfirmDeleteButton from "./ConfirmDeleteButton";

interface SettingsTabProps {
  categories: UserCategory[];
  creditCards: UserCreditCard[];
  dashboardFields: UserDashboardField[];
  onAddCategory: (name: string, type: string) => void;
  onDeleteCategory: (id: string) => void;
  onUpdateCategoryName: (id: string, name: string) => void;
  onAddCard: (name: string, limit: number) => void;
  onDeleteCard: (id: string) => void;
  onUpdateCardLimit: (id: string, limit: number) => void;
  onUpdateCardName: (id: string, name: string) => void;
  onAddDashboardField: (label: string, fieldType: string, category?: string) => void;
  onDeleteDashboardField: (id: string) => void;
  onToggleFieldVisibility: (id: string) => void;
  onUpdateDashboardField: (id: string, label: string, fieldType: string, category?: string) => void;
  onReorderDashboardFields: (orderedIds: string[]) => void;
}

const defaultFieldTypeOptions = [
  { value: "income", label: "Receitas" },
  { value: "expense", label: "Despesas" },
  { value: "balance", label: "Saldo" },
];

const SettingsTab = ({
  categories, creditCards, dashboardFields,
  onAddCategory, onDeleteCategory, onUpdateCategoryName,
  onAddCard, onDeleteCard, onUpdateCardLimit, onUpdateCardName,
  onAddDashboardField, onDeleteDashboardField, onToggleFieldVisibility, onUpdateDashboardField, onReorderDashboardFields,
}: SettingsTabProps) => {
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState("expense");
  const [customCatType, setCustomCatType] = useState("");
  const [newCardName, setNewCardName] = useState("");
  const [newCardLimit, setNewCardLimit] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("");
  const [newFieldCategory, setNewFieldCategory] = useState("");
  const [customFieldType, setCustomFieldType] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardName, setEditingCardName] = useState("");
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const fieldTypeOptions = (() => {
    const opts = [...defaultFieldTypeOptions];
    const existing = new Set(opts.map((o) => o.value));
    // Add all category types as field type options
    categories.forEach((c) => {
      if (!existing.has(c.type)) {
        opts.push({ value: c.type, label: c.type.charAt(0).toUpperCase() + c.type.slice(1) });
        existing.add(c.type);
      }
    });
    dashboardFields.forEach((f) => {
      if (!existing.has(f.fieldType)) {
        opts.push({ value: f.fieldType, label: f.fieldType });
        existing.add(f.fieldType);
      }
    });
    return opts;
  })();

  // Group categories by type dynamically
  const typeGroups = (() => {
    const groups: Record<string, typeof categories> = {};
    categories.forEach((c) => {
      if (!groups[c.type]) groups[c.type] = [];
      groups[c.type].push(c);
    });
    return groups;
  })();

  const allTypes = Object.keys(typeGroups);

  const typeLabel = (t: string) => {
    if (t === "income") return "Receitas";
    if (t === "expense") return "Despesas";
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  const typeColor = (t: string) => {
    if (t === "income") return "text-income";
    if (t === "expense") return "text-expense";
    return "text-primary";
  };


  // Categories relevant to field type
  const getCategoriesForType = (type: string) => {
    const filtered = categories.filter((c) => c.type === type);
    return filtered.length > 0 ? filtered : categories;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Categories */}
      <section className="bg-card rounded-lg shadow-card border border-border p-5">
        <h3 className="text-lg font-bold font-display text-card-foreground mb-4">Categorias</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allTypes.map((t) => (
            <div key={t}>
              <h4 className={`text-sm font-semibold ${typeColor(t)} mb-2`}>{typeLabel(t)}</h4>
              <div className="space-y-1.5">
                {typeGroups[t].map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 bg-muted/30 rounded-md px-3 py-2">
                    {editingCatId === c.id ? (
                      <>
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editingCatName.trim()) {
                              onUpdateCategoryName(c.id, editingCatName.trim());
                              setEditingCatId(null);
                            } else if (e.key === "Escape") setEditingCatId(null);
                          }}
                          className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          onClick={() => { if (editingCatName.trim()) { onUpdateCategoryName(c.id, editingCatName.trim()); setEditingCatId(null); } }}
                          className="text-income text-xs font-semibold"
                        >Salvar</button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-foreground flex-1 truncate">{c.name}</span>
                        <button
                          onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name); }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Editar categoria"
                        >
                          <Pencil size={14} />
                        </button>
                        <ConfirmDeleteButton
                          onConfirm={() => onDeleteCategory(c.id)}
                          title="Excluir categoria?"
                          description={`A categoria "${c.name}" será removida. Lançamentos existentes não serão alterados.`}
                          ariaLabel="Remover categoria"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-border">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nova categoria</label>
            <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nome..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
            <select value={newCatType} onChange={(e) => { setNewCatType(e.target.value); setCustomCatType(""); }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
              {allTypes.filter((t) => t !== "income" && t !== "expense").map((t) => (
                <option key={t} value={t}>{typeLabel(t)}</option>
              ))}
              <option value="__custom">+ Novo tipo...</option>
            </select>
          </div>
          {newCatType === "__custom" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do tipo</label>
              <input type="text" value={customCatType} onChange={(e) => setCustomCatType(e.target.value)} placeholder="Ex: Reserva..."
                className="w-36 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}
          <button onClick={() => {
            if (newCatName.trim()) {
              const finalType = newCatType === "__custom" ? customCatType.trim().toLowerCase() : newCatType;
              if (!finalType) return;
              onAddCategory(newCatName.trim(), finalType);
              setNewCatName("");
              setCustomCatType("");
            }
          }}
            className="gradient-warm text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity">
            <Plus size={15} /> Adicionar
          </button>
        </div>
      </section>

      {/* Credit Cards */}
      <section className="bg-card rounded-lg shadow-card border border-border p-5">
        <h3 className="text-lg font-bold font-display text-card-foreground mb-4">Cartões de Crédito</h3>
        <div className="space-y-2">
          {creditCards.map((card) => (
            <div key={card.id} className="flex items-center gap-3 bg-muted/30 rounded-md px-3 py-2.5 flex-wrap">
              {editingCardId === card.id ? (
                <input
                  type="text"
                  value={editingCardName}
                  onChange={(e) => setEditingCardName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editingCardName.trim()) {
                      onUpdateCardName(card.id, editingCardName.trim());
                      setEditingCardId(null);
                    } else if (e.key === "Escape") setEditingCardId(null);
                  }}
                  className="flex-1 min-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ) : (
                <span className="text-sm font-medium text-foreground flex-1">{card.name}</span>
              )}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Limite:</label>
                <input type="number" min="0" step="0.01" value={card.cardLimit}
                  onChange={(e) => onUpdateCardLimit(card.id, Number(e.target.value) || 0)}
                  className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              {editingCardId === card.id ? (
                <button
                  onClick={() => { if (editingCardName.trim()) { onUpdateCardName(card.id, editingCardName.trim()); setEditingCardId(null); } }}
                  className="text-income text-xs font-semibold"
                >Salvar</button>
              ) : (
                <button
                  onClick={() => { setEditingCardId(card.id); setEditingCardName(card.name); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Editar nome do cartão"
                >
                  <Pencil size={14} />
                </button>
              )}
              <ConfirmDeleteButton
                onConfirm={() => onDeleteCard(card.id)}
                title="Excluir cartão?"
                description={`O cartão "${card.name}" será removido. Lançamentos existentes manterão a referência atual.`}
                ariaLabel="Remover cartão"
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-border">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Novo cartão</label>
            <input type="text" value={newCardName} onChange={(e) => setNewCardName(e.target.value)} placeholder="Nome..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Limite (R$)</label>
            <input type="number" min="0" step="0.01" value={newCardLimit} onChange={(e) => setNewCardLimit(e.target.value)} placeholder="0,00"
              className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button onClick={() => { if (newCardName.trim()) { onAddCard(newCardName.trim(), Number(newCardLimit) || 0); setNewCardName(""); setNewCardLimit(""); } }}
            className="gradient-warm text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity">
            <Plus size={15} /> Adicionar
          </button>
        </div>
      </section>

      {/* Dashboard Fields */}
      <section className="bg-card rounded-lg shadow-card border border-border p-5">
        <h3 className="text-lg font-bold font-display text-card-foreground mb-4">Campos do Painel</h3>
        <div className="space-y-2">
          {dashboardFields.map((field) => (
            <div
              key={field.id}
              draggable={editingField !== field.id}
              onDragStart={() => { dragIdRef.current = field.id; setDragOverId(null); }}
              onDragOver={(e) => { e.preventDefault(); if (dragOverId !== field.id) setDragOverId(field.id); }}
              onDragLeave={() => { if (dragOverId === field.id) setDragOverId(null); }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIdRef.current;
                dragIdRef.current = null;
                setDragOverId(null);
                if (!from || from === field.id) return;
                const ids = dashboardFields.map((f) => f.id);
                const fromIdx = ids.indexOf(from);
                const toIdx = ids.indexOf(field.id);
                if (fromIdx < 0 || toIdx < 0) return;
                ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0]);
                onReorderDashboardFields(ids);
              }}
              onDragEnd={() => { dragIdRef.current = null; setDragOverId(null); }}
              className={`flex items-center gap-3 bg-muted/30 rounded-md px-2 py-2.5 flex-wrap transition-colors ${
                dragOverId === field.id ? "ring-2 ring-primary/60" : ""
              }`}
            >
              <span
                className="text-muted-foreground cursor-grab active:cursor-grabbing select-none"
                aria-label="Arrastar para reordenar"
                title="Arrastar para reordenar"
              >
                <GripVertical size={16} />
              </span>
              {editingField === field.id ? (
                <>
                  <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { onUpdateDashboardField(field.id, editLabel, editType, editCategory || undefined); setEditingField(null); }
                      else if (e.key === "Escape") setEditingField(null);
                    }}
                    className="flex-1 min-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                  <select value={editType} onChange={(e) => { setEditType(e.target.value); setEditCategory(""); }}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    {fieldTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {(editType === "income" || editType === "expense") && (
                    <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Todas as categorias</option>
                      {getCategoriesForType(editType).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  )}
                  <button onClick={() => { onUpdateDashboardField(field.id, editLabel, editType, editCategory || undefined); setEditingField(null); }}
                    className="text-income text-xs font-semibold">Salvar</button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground flex-1">{field.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {fieldTypeOptions.find((o) => o.value === field.fieldType)?.label ?? field.fieldType}
                  </span>
                  {field.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {field.category}
                    </span>
                  )}
                  <button onClick={() => onToggleFieldVisibility(field.id)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label={field.visible ? "Ocultar campo" : "Exibir campo"}>
                    {field.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => { setEditingField(field.id); setEditLabel(field.label); setEditType(field.fieldType); setEditCategory(field.category || ""); }}
                    className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Editar campo">
                    <Pencil size={14} />
                  </button>
                  <ConfirmDeleteButton
                    onConfirm={() => onDeleteDashboardField(field.id)}
                    title="Excluir campo do painel?"
                    description={`O campo "${field.label}" será removido do painel.`}
                    ariaLabel="Remover campo"
                  />
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-border">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Novo campo</label>
            <input type="text" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="Rótulo..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
            <select value={newFieldType} onChange={(e) => { setNewFieldType(e.target.value); setNewFieldCategory(""); }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Selecione...</option>
              {fieldTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              <option value="__custom">+ Novo tipo...</option>
            </select>
          </div>
          {newFieldType === "__custom" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do tipo</label>
              <input type="text" value={customFieldType} onChange={(e) => setCustomFieldType(e.target.value)} placeholder="Ex: reserva..."
                className="w-36 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}
          {(newFieldType === "income" || newFieldType === "expense") && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Categoria</label>
              <select value={newFieldCategory} onChange={(e) => setNewFieldCategory(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todas</option>
                {getCategoriesForType(newFieldType).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          )}
          <button onClick={() => {
            if (newFieldLabel.trim()) {
              const type = newFieldType === "__custom" ? customFieldType.trim() : newFieldType;
              if (!type) return;
              onAddDashboardField(newFieldLabel.trim(), type, newFieldCategory || undefined);
              setNewFieldLabel(""); setNewFieldType(""); setCustomFieldType(""); setNewFieldCategory("");
            }
          }} className="gradient-warm text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity">
            <Plus size={15} /> Adicionar
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsTab;
