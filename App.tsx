import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Plus, 
  LayoutList, 
  Kanban as KanbanIcon, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Trash2, 
  Sparkles, 
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  Flag,
  AlertCircle,
  ArrowUpCircle,
  GripVertical,
  LogOut,
  Loader2,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  Database,
  Settings as SettingsIcon,
  WifiOff,
  ClipboardPaste,
  ArrowDown,
  ShieldAlert,
  Search,
  Copy,
  Check,
  ChevronRight,
  PanelLeftClose,
  Command,
  Square,
  CheckSquare,
  ListTodo,
  Layers,
  Download,
  Upload,
  FileJson,
  RefreshCw,
  Eraser
} from 'lucide-react';
import { Project, Task, TaskStatus, TaskPriority, ViewMode } from './types';
import { generateTasksFromInput } from './services/geminiService';
import { auth, db, saveConfig, isFirebaseConfigured, getStoredConfig, resetConfig } from './services/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  writeBatch,
  setDoc
} from 'firebase/firestore';

// --- Helpers ---

// Helper for ID generation to avoid crypto type issues
const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// --- Components ---

const FastTrackLogo = ({ className = "w-8 h-8", iconSize = 20 }: { className?: string, iconSize?: number }) => (
  <div className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 shadow-lg shadow-blue-500/20 ${className}`}>
      {/* Abstract F / Forward motion symbol */}
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white drop-shadow-sm">
        <path d="M4 12L9 7L13 15L20 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 17L14 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
      </svg>
  </div>
);

const PriorityBadge = ({ priority, onClick }: { priority: TaskPriority; onClick?: () => void }) => {
  const styles = {
    [TaskPriority.LOW]: 'text-slate-400 hover:bg-slate-800',
    [TaskPriority.MEDIUM]: 'text-yellow-500 hover:bg-yellow-500/10',
    [TaskPriority.HIGH]: 'text-red-500 hover:bg-red-500/10',
  };

  const icons = {
    [TaskPriority.LOW]: <Flag size={14} />,
    [TaskPriority.MEDIUM]: <AlertCircle size={14} />,
    [TaskPriority.HIGH]: <ArrowUpCircle size={14} />,
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-all ${styles[priority]} no-drag`}
      title={`Priorità: ${priority}`}
    >
      {icons[priority]}
      <span className="hidden sm:inline">{priority}</span>
    </button>
  );
};

const StatusBadge = ({ status, onClick }: { status: TaskStatus; onClick?: () => void }) => {
  const styles = {
    [TaskStatus.TODO]: 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600',
    [TaskStatus.TEST]: 'bg-orange-900/40 text-orange-400 border-orange-700/50 hover:bg-orange-900/60',
    [TaskStatus.DONE]: 'bg-green-900/30 text-green-400 border-green-700/50 hover:bg-green-900/50',
  };

  const icons = {
    [TaskStatus.TODO]: <Circle size={14} className="mr-1.5" />,
    [TaskStatus.TEST]: <Clock size={14} className="mr-1.5" />,
    [TaskStatus.DONE]: <CheckCircle2 size={14} className="mr-1.5" />,
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      className={`flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${styles[status]} transition-all no-drag`}
    >
      {icons[status]}
      {status}
    </button>
  );
};

// Component for Inline Editable Text
const InlineEditableText = React.forwardRef<HTMLTextAreaElement, { 
  text: string; 
  isDone?: boolean; 
  onSave: (newText: string) => void;
  className?: string;
  placeholder?: string;
}>(({ 
  text, 
  isDone = false, 
  onSave,
  className = "",
  placeholder = ""
}, ref) => {
  const [value, setValue] = useState(text);
  const innerRef = useRef<HTMLTextAreaElement>(null);
  
  // Use passed ref or inner ref
  const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || innerRef;

  useEffect(() => {
    setValue(text);
  }, [text]);

  const handleBlur = () => {
    if (value.trim() !== text) {
      onSave(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && isDone !== undefined) {
       e.preventDefault();
       textareaRef.current?.blur();
    }
  };

  const adjustHeight = () => {
     if(textareaRef.current) {
         textareaRef.current.style.height = 'auto';
         textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
     }
  };

  useEffect(() => { adjustHeight(); }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      // HACK: Rendi draggable=true ma previeni default su dragStart. 
      // Questo dice al browser "Gestisco io il drag qui (non facendo nulla)", isolandolo dal genitore.
      draggable={true}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={`w-full bg-transparent border border-transparent rounded px-1 -ml-1 resize-none overflow-hidden focus:bg-slate-800 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-primary transition-all whitespace-pre-wrap break-words cursor-text pointer-events-auto no-drag ${isDone ? 'text-slate-500 line-through' : 'text-slate-200'} ${className}`}
      // Native events to stop propagation
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      rows={1}
      placeholder={placeholder}
    />
  );
});

InlineEditableText.displayName = 'InlineEditableText';

const CollapsibleDescription = ({ text, onUpdate }: { text: string, onUpdate: (val: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    if (!text) return null;

    return (
        <div className="mt-0.5 w-full no-drag">
            {!isOpen ? (
                <button 
                    onClick={() => setIsOpen(true)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-primary transition-colors select-none leading-none py-0.5"
                >
                    <ChevronDown size={12} />
                    Mostra note ({text.split('\n')[0].substring(0, 30)}...)
                </button>
            ) : (
                <div 
                    className="bg-slate-900/50 rounded p-2 border border-slate-800/50 w-full animate-in fade-in zoom-in-95 duration-200 cursor-auto no-drag mt-1"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-1 text-[10px] text-primary hover:text-blue-300 font-medium mb-1 select-none"
                    >
                        <ChevronUp size={12} /> Nascondi note
                    </button>
                    <InlineEditableText 
                        text={text} 
                        onSave={onUpdate}
                        className="text-xs text-slate-400 min-h-[60px]"
                        placeholder="Aggiungi note..."
                    />
                </div>
            )}
        </div>
    );
};

interface TaskItemProps {
  task: Task;
  viewMode: ViewMode;
  isSelected: boolean;
  onToggleSelection: () => void;
  onCycleStatus: (task: Task) => void;
  onCyclePriority: (task: Task) => void;
  onUpdateTitle: (task: Task, newTitle: string) => void;
  onUpdateDescription: (task: Task, newDesc: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ 
  task, 
  viewMode, 
  isSelected,
  onToggleSelection,
  onCycleStatus, 
  onCyclePriority, 
  onUpdateTitle, 
  onUpdateDescription,
  onEdit, 
  onDelete, 
  onDragStart 
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const desc = (task.description || '').replace(/[\r\n]+/g, ' ').trim();
    const content = `${task.title} ${desc}`.trim();
    
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDragStartInternal = (e: React.DragEvent) => {
      const target = e.target as HTMLElement;
      // Controllo rigoroso: se l'elemento è marcato no-drag o è un input, BLOCCA il drag.
      if (target.closest('.no-drag') || ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(target.tagName)) {
          e.preventDefault();
          e.stopPropagation();
          return;
      }
      onDragStart(e, task.id);
  };

  return (
    <div 
      draggable="true"
      onDragStart={handleDragStartInternal}
      className={`group relative bg-surface rounded-lg border transition-all shadow-sm cursor-grab active:cursor-grabbing ${viewMode === 'LIST' ? 'flex flex-col md:flex-row md:items-start px-3 py-2 mb-1.5' : 'px-3 py-2 mb-1.5 flex flex-col'} ${isSelected ? 'border-primary/60 bg-primary/5' : 'border-slate-700/50 hover:border-primary/40'}`}
    >
      <div className="absolute left-0.5 top-1/2 -translate-y-1/2 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block pointer-events-none">
          <GripVertical size={12} />
      </div>

      <div className={`flex items-start flex-1 min-w-0 ${viewMode === 'LIST' ? 'md:ml-3 md:mr-4' : 'mb-1'}`}>
         {/* Checkbox Selection */}
         <div 
            onClick={(e) => { e.stopPropagation(); onToggleSelection(); }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className={`mr-2.5 mt-0.5 cursor-pointer transition-colors no-drag ${isSelected ? 'text-primary' : 'text-slate-600 hover:text-slate-400'}`}
         >
             {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
         </div>

         <div className="flex-1 min-w-0">
            <InlineEditableText 
            text={task.title} 
            isDone={task.status === TaskStatus.DONE} 
            onSave={(val) => onUpdateTitle(task, val)} 
            className="text-sm font-medium leading-tight"
            />
            {viewMode === 'LIST' && task.description && (
            <CollapsibleDescription 
                text={task.description} 
                onUpdate={(val) => onUpdateDescription(task, val)}
            />
            )}
            {viewMode === 'KANBAN' && task.description && (
            <div 
                className="mt-1 text-[11px] text-slate-500 line-clamp-2 whitespace-pre-wrap leading-tight no-drag cursor-text"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >{task.description}</div>
            )}
         </div>
      </div>

      <div className={`flex items-center justify-between ${viewMode === 'LIST' ? 'gap-3 mt-1 md:mt-0 md:self-start' : 'w-full pt-1.5 border-t border-slate-700/50 mt-1'}`}
        // Stop propagation on action bar to prevent drag start from empty spaces in toolbar
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 no-drag">
          <StatusBadge status={task.status} onClick={() => onCycleStatus(task)} />
          <PriorityBadge priority={task.priority} onClick={() => onCyclePriority(task)} />
        </div>
        
        <div className={`flex items-center gap-1 transition-opacity no-drag`}>
          <button 
              onClick={handleCopy}
              className="p-1 text-slate-500 hover:text-green-400 hover:bg-slate-700 rounded transition-colors"
              title="Copia Titolo e Note (Inline)"
          >
              {isCopied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
          </button>
          <button 
              onClick={() => onEdit(task)}
              className="p-1 text-slate-500 hover:text-primary hover:bg-slate-700 rounded transition-colors"
              title="Modifica dettaglio"
          >
              <Pencil size={13} />
          </button>
          <button 
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} 
              className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
              title="Elimina"
          >
              <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Config & Backup Modal ---

const FirebaseConfigModal = ({ 
    isOpen, 
    onClose, 
    onSave, 
    dataToBackup,
    userId
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    onSave: (cfg: any) => void,
    dataToBackup: { projects: Project[], tasks: Task[] },
    userId: string | undefined
}) => {
    const [config, setConfig] = useState({
        apiKey: "",
        authDomain: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: ""
    });
    const [pasteInput, setPasteInput] = useState("");
    const [parseSuccess, setParseSuccess] = useState(false);
    const [backupLoading, setBackupLoading] = useState(false);
    const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Preload existing config if available
        if (isOpen) {
            const saved = getStoredConfig();
            if (saved) setConfig(saved);
        }
    }, [isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({...config, [e.target.name]: e.target.value});
        setParseSuccess(false);
    };

    const handlePasteParse = () => {
        if (!pasteInput.trim()) return;

        const newConfig = { ...config };
        let found = false;
        const keys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];

        keys.forEach(key => {
            const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`);
            const match = pasteInput.match(regex);
            if (match && match[1]) {
                (newConfig as any)[key] = match[1];
                found = true;
            }
        });

        if (found) {
            setConfig(newConfig);
            setParseSuccess(true);
            setPasteInput("");
            setTimeout(() => setParseSuccess(false), 3000);
        } else {
            alert("Nessuna configurazione valida trovata nel testo incollato.");
        }
    };

    const handleBackup = () => {
        if (!userId) return;
        
        const backupData = {
            timestamp: Date.now(),
            version: "1.0",
            userId: userId,
            source: isFirebaseConfigured ? "firebase" : "local",
            projects: dataToBackup.projects,
            tasks: dataToBackup.tasks
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fasttrack-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        setBackupLoading(true);
        setRestoreStatus("Analisi file...");

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                
                if (!Array.isArray(json.projects) || !Array.isArray(json.tasks)) {
                    throw new Error("Formato backup non valido");
                }

                const projectsToRestore = json.projects as Project[];
                const tasksToRestore = json.tasks as Task[];

                setRestoreStatus(`Ripristino di ${projectsToRestore.length} progetti e ${tasksToRestore.length} task...`);

                if (isFirebaseConfigured && db) {
                    // Firebase Restore (Batch)
                    const batchSize = 450; // Firestore limit is 500
                    let batch = writeBatch(db);
                    let count = 0;

                    const commitBatch = async () => {
                        await batch.commit();
                        batch = writeBatch(db);
                        count = 0;
                    };

                    // Process Projects
                    for (const p of projectsToRestore) {
                        const ref = doc(db, "projects", p.id);
                        // Force userId to current user
                        batch.set(ref, { ...p, userId: userId }, { merge: true });
                        count++;
                        if (count >= batchSize) await commitBatch();
                    }

                    // Process Tasks
                    for (const t of tasksToRestore) {
                        const ref = doc(db, "tasks", t.id);
                        batch.set(ref, { ...t, userId: userId }, { merge: true });
                        count++;
                        if (count >= batchSize) await commitBatch();
                    }

                    if (count > 0) await commitBatch();

                } else {
                    // Local Restore (Merge)
                    const currentProjects = JSON.parse(localStorage.getItem('ft_projects_local') || '[]');
                    const currentTasks = JSON.parse(localStorage.getItem('ft_tasks_local') || '[]');
                    
                    // Merge strategies: imported wins if ID matches
                    const mergedProjects = [...currentProjects];
                    projectsToRestore.forEach(p => {
                        const idx = mergedProjects.findIndex(cp => cp.id === p.id);
                        if (idx >= 0) mergedProjects[idx] = { ...p, userId };
                        else mergedProjects.push({ ...p, userId });
                    });

                    const mergedTasks = [...currentTasks];
                    tasksToRestore.forEach(t => {
                        const idx = mergedTasks.findIndex(ct => ct.id === t.id);
                        if (idx >= 0) mergedTasks[idx] = { ...t, userId };
                        else mergedTasks.push({ ...t, userId });
                    });

                    localStorage.setItem('ft_projects_local', JSON.stringify(mergedProjects));
                    localStorage.setItem('ft_tasks_local', JSON.stringify(mergedTasks));
                    
                    // Force reload to see changes
                    window.location.reload();
                }

                setRestoreStatus("Ripristino completato con successo!");
                setTimeout(() => setRestoreStatus(null), 3000);

            } catch (error) {
                console.error(error);
                setRestoreStatus("Errore durante il ripristino: " + (error as any).message);
            } finally {
                setBackupLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="w-full max-w-lg bg-surface border border-slate-700 rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
                
                <div className="flex items-center gap-3 mb-6 shrink-0">
                    <div className="w-10 h-10 bg-orange-500/20 text-orange-500 rounded-lg flex items-center justify-center">
                        <Database size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Configurazione & Dati</h1>
                        <p className="text-sm text-slate-400">Gestisci connessione cloud e backup</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                    
                    {/* SEZIONE 1: CONFIGURAZIONE */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-1">Connessione Firebase</h3>
                        
                        {/* Area Incolla Rapido */}
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <ClipboardPaste size={14} />
                                Incolla Configurazione Rapida
                            </label>
                            <textarea
                                value={pasteInput}
                                onChange={(e) => setPasteInput(e.target.value)}
                                placeholder={`const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  ...\n};`}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:border-primary focus:outline-none h-20 resize-none mb-2"
                            />
                            <button
                                onClick={handlePasteParse}
                                disabled={!pasteInput.trim()}
                                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded border border-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <ArrowDown size={12} />
                                Analizza ed Estrai Dati
                            </button>
                            {parseSuccess && (
                                <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Campi compilati!
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {Object.keys(config).map((key) => (
                                <div key={key}>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{key}</label>
                                    <input 
                                        type="text"
                                        name={key}
                                        value={(config as any)[key]}
                                        onChange={handleChange}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-primary focus:outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SEZIONE 2: BACKUP & RESTORE */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-1">Backup e Ripristino</h3>
                        <p className="text-xs text-slate-400">
                            Esporta tutti i tuoi progetti e task in un file JSON per sicurezza, oppure importa un backup precedente.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={handleBackup}
                                className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-900 border border-slate-700 hover:border-primary/50 hover:bg-slate-800 rounded-xl transition-all group"
                            >
                                <div className="p-2 bg-slate-800 group-hover:bg-primary/20 rounded-full text-slate-400 group-hover:text-primary transition-colors">
                                    <Download size={20} />
                                </div>
                                <span className="text-xs font-bold text-slate-300">Scarica Backup</span>
                            </button>

                            <button 
                                onClick={handleRestoreClick}
                                disabled={backupLoading}
                                className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-900 border border-slate-700 hover:border-orange-500/50 hover:bg-slate-800 rounded-xl transition-all group disabled:opacity-50"
                            >
                                <div className="p-2 bg-slate-800 group-hover:bg-orange-500/20 rounded-full text-slate-400 group-hover:text-orange-500 transition-colors">
                                    {backupLoading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                                </div>
                                <span className="text-xs font-bold text-slate-300">Ripristina Dati</span>
                            </button>
                            <input 
                                type="file" 
                                accept=".json" 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleFileChange}
                            />
                        </div>

                        {restoreStatus && (
                            <div className={`text-xs p-2 rounded border flex items-center gap-2 ${restoreStatus.includes('Errore') ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
                                <RefreshCw size={12} className={backupLoading ? "animate-spin" : ""} />
                                {restoreStatus}
                            </div>
                        )}
                    </div>

                </div>

                <div className="mt-6 flex gap-3 shrink-0 pt-4 border-t border-slate-800">
                     {isFirebaseConfigured && (
                         <button 
                            onClick={resetConfig}
                            className="px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors"
                         >
                            Reset
                         </button>
                     )}
                     <button 
                        onClick={() => onSave(config)}
                        disabled={!config.apiKey}
                        className="flex-1 bg-primary hover:bg-blue-600 text-white font-bold py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        Salva e Riavvia
                     </button>
                </div>
             </div>
        </div>
    );
};

// --- Login/Register Screen ---

const LoginScreen = ({ onMockLogin }: { onMockLogin: () => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // MOCK LOGIN if firebase is not configured
    if (!isFirebaseConfigured) {
        // Simulate network delay
        setTimeout(() => {
            onMockLogin();
            setLoading(false);
        }, 800);
        return;
    }

    if (!auth) {
        setError("Errore configurazione auth.");
        setLoading(false);
        return;
    }

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      let msg = "Si è verificato un errore.";
      if (err.code === 'auth/invalid-email') msg = "Indirizzo email non valido.";
      if (err.code === 'auth/user-not-found') msg = "Utente non trovato.";
      if (err.code === 'auth/wrong-password') msg = "Password non corretta.";
      if (err.code === 'auth/email-already-in-use') msg = "Email già registrata.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-md bg-surface border border-slate-700/50 rounded-2xl shadow-2xl p-8 relative z-10 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <FastTrackLogo className="w-16 h-16 mb-4" iconSize={32} />
          <h1 className="text-2xl font-bold text-white mb-1">FastTrack</h1>
          <p className="text-slate-400 text-sm text-center">
            {isFirebaseConfigured 
                ? (isRegister ? 'Crea un account Cloud' : 'Accedi al tuo account Cloud')
                : 'Modalità Locale: Accedi con qualsiasi credenziale'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 ml-1">USERNAME / EMAIL</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type={isFirebaseConfigured ? "email" : "text"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isFirebaseConfigured ? "nome@esempio.com" : "Inserisci un nome a caso..."}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 ml-1">PASSWORD</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          {!isFirebaseConfigured && (
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs p-3 rounded-lg flex items-start gap-2">
                  <WifiOff size={14} className="shrink-0 mt-0.5" />
                  <span>
                      Firebase non è configurato. L'accesso avverrà in <strong>Modalità Locale</strong>. 
                      Potrai configurare il Cloud dalle impostazioni.
                  </span>
              </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (isRegister ? 'Registrati' : 'Accedi')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {isFirebaseConfigured && (
            <div className="mt-6 text-center">
            <button 
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(null); }}
                className="text-sm text-slate-400 hover:text-white transition-colors"
            >
                {isRegister ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
            </button>
            </div>
        )}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  // Mock User State (Local Mode)
  const [mockUser, setMockUser] = useState<User | null>(null);

  // Auth State (Firebase Mode)
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Derived User
  const user = isFirebaseConfigured ? fbUser : mockUser;

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  
  // Collapsed Groups State
  const [collapsedGroups, setCollapsedGroups] = useState<Record<TaskStatus, boolean>>({
      [TaskStatus.TODO]: false,
      [TaskStatus.TEST]: false,
      [TaskStatus.DONE]: true // Default collapsed
  });
  
  // Database Error State
  const [dbError, setDbError] = useState<string | null>(null);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newProjectInput, setNewProjectInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  
  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, count: number, onConfirm: () => void}>({
      isOpen: false, count: 0, onConfirm: () => {}
  });
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Drag State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  
  // Editing states
  const [editingProjectName, setEditingProjectName] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Search Shortcut Effect ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            searchInputRef.current?.focus();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Auth Effect ---
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setFbUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    } else {
        // In local mode, we are ready immediately (user is null until login)
        setAuthLoading(false);
    }
  }, []);

  // --- Selection Clear Effect ---
  useEffect(() => {
    // Pulisci selezione quando cambi progetto o modalità
    setSelectedTaskIds(new Set());
    setSearchQuery('');
  }, [activeProjectId, viewMode]);

  // --- Data Sync (Hybrid: Local vs Firestore) ---
  
  // Projects Sync
  useEffect(() => {
    if (!user) {
        setProjects([]);
        return;
    }
    
    if (isFirebaseConfigured && db) {
        setDbError(null);
        // FIRESTORE
        const q = query(collection(db, "projects"), where("userId", "==", user.uid));
        const unsubscribe = onSnapshot(q, 
          (snapshot) => {
            const projData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)).sort((a, b) => a.createdAt - b.createdAt);
            setProjects(projData);
            if (projData.length > 0 && !activeProjectId) {
                setActiveProjectId(projData[0].id);
            } else if (projData.length === 0) {
                setActiveProjectId(null);
            }
          },
          (error) => {
            console.error("Firestore Projects Error:", error);
            if (error.code === 'permission-denied') {
              setDbError("Permesso negato. Controlla le regole di sicurezza nel database Firebase.");
            }
          }
        );
        return () => unsubscribe();
    } else {
        // LOCAL STORAGE
        const saved = localStorage.getItem(`ft_projects_local`);
        if (saved) {
            const parsed = JSON.parse(saved) as Project[];
            // Simple validation
            if (Array.isArray(parsed)) {
                setProjects(parsed);
                if (parsed.length > 0 && !activeProjectId) setActiveProjectId(parsed[0].id);
            }
        }
    }
  }, [user, isFirebaseConfigured]); 

  // Tasks Sync
  useEffect(() => {
    if (!user) {
        setTasks([]);
        return;
    }

    if (isFirebaseConfigured && db) {
        // FIRESTORE
        const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
        const unsubscribe = onSnapshot(q, 
          (snapshot) => {
            const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
            setTasks(taskData);
          },
          (error) => {
             // Don't overwrite error if already set by projects
             console.error("Firestore Tasks Error:", error);
             if (error.code === 'permission-denied') {
               setDbError((prev) => prev || "Permesso negato. Controlla le regole di sicurezza nel database Firebase.");
             }
          }
        );
        return () => unsubscribe();
    } else {
        // LOCAL STORAGE
        const saved = localStorage.getItem(`ft_tasks_local`);
        if (saved) {
            const parsed = JSON.parse(saved) as Task[];
            if (Array.isArray(parsed)) setTasks(parsed);
        }
    }
  }, [user, isFirebaseConfigured]);

  // --- Helper to Save Local ---
  const saveLocalProjects = (newProjects: Project[]) => {
      setProjects(newProjects);
      localStorage.setItem(`ft_projects_local`, JSON.stringify(newProjects));
  };
  const saveLocalTasks = (newTasks: Task[]) => {
      setTasks(newTasks);
      localStorage.setItem(`ft_tasks_local`, JSON.stringify(newTasks));
  };

  // --- Actions ---

  const handleMockLogin = () => {
      // Create a fake user object
      const fakeUser: any = {
          uid: 'local-user',
          email: 'local@demo.com',
          displayName: 'Utente Locale'
      };
      setMockUser(fakeUser);
  };

  const handleLogout = () => {
    if(isFirebaseConfigured && auth) {
        signOut(auth);
    } else {
        setMockUser(null);
    }
  };

  const addProject = async () => {
    if (!newProjectInput.trim() || !user) return;
    const newProjData = {
        userId: user.uid,
        name: newProjectInput.trim(),
        createdAt: Date.now()
    };

    if (isFirebaseConfigured && db) {
        try {
            await addDoc(collection(db, "projects"), newProjData);
        } catch (e) { console.error(e); }
    } else {
        // Local
        const newProj: Project = { id: generateId(), ...newProjData };
        saveLocalProjects([...projects, newProj]);
        setActiveProjectId(newProj.id);
    }
    setNewProjectInput('');
  };

  const renameProject = async (newName: string) => {
    if (!activeProjectId || !newName.trim()) return;
    
    if (isFirebaseConfigured && db) {
        try {
            const projRef = doc(db, "projects", activeProjectId);
            await updateDoc(projRef, { name: newName.trim() });
        } catch (e) { console.error(e); }
    } else {
        const updated = projects.map(p => p.id === activeProjectId ? { ...p, name: newName.trim() } : p);
        saveLocalProjects(updated);
    }
    setEditingProjectName(null);
  };

  const deleteProject = async (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm('Sei sicuro? Questo eliminerà il progetto e TUTTI i suoi task.')) return;

    if (isFirebaseConfigured && db) {
        try {
            await deleteDoc(doc(db, "projects", projId));
            const projectTasks = tasks.filter(t => t.projectId === projId);
            projectTasks.forEach(async (t) => { await deleteDoc(doc(db, "tasks", t.id)); });
        } catch (e) { console.error(e); }
    } else {
        const updatedProjs = projects.filter(p => p.id !== projId);
        saveLocalProjects(updatedProjs);
        if (activeProjectId === projId) setActiveProjectId(updatedProjs.length > 0 ? updatedProjs[0].id : null);
        
        // Delete related tasks
        const updatedTasks = tasks.filter(t => t.projectId !== projId);
        saveLocalTasks(updatedTasks);
    }
  };

  const addTask = async (title: string, desc: string) => {
    if (!activeProjectId || !title.trim() || !user) return;
    
    const newTaskData = {
        userId: user.uid,
        projectId: activeProjectId,
        title: title.trim(),
        description: desc.trim(),
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM, // DEFAULT MEDIUM
        createdAt: Date.now()
    };

    if (isFirebaseConfigured && db) {
        try {
             await addDoc(collection(db, "tasks"), newTaskData);
        } catch(e) { console.error(e); }
    } else {
        const newTask: Task = { id: generateId(), ...newTaskData };
        saveLocalTasks([...tasks, newTask]);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (isFirebaseConfigured && db) {
        try {
            const taskRef = doc(db, "tasks", taskId);
            await updateDoc(taskRef, updates);
        } catch(e) { console.error(e); }
    } else {
        const updated = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
        saveLocalTasks(updated);
    }
  };

  const deleteTask = async (taskId: string) => {
     // Soft delete
     await updateTask(taskId, { deletedAt: Date.now() });
     // NOTA: Non gestiamo più la selezione qui per evitare loop in eliminazione massiva
  };

  // --- Bulk Actions ---

  const toggleTaskSelection = (taskId: string) => {
      const newSet = new Set(selectedTaskIds);
      if (newSet.has(taskId)) {
          newSet.delete(taskId);
      } else {
          newSet.add(taskId);
      }
      setSelectedTaskIds(newSet);
  };

  const handleBulkCopy = () => {
      const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id));
      if (selectedTasks.length === 0) return;

      const text = selectedTasks.map(t => {
          // Concatena titolo e descrizione (pulita da newline)
          const desc = (t.description || '').replace(/[\r\n]+/g, ' ').trim();
          // Formatta come lista puntata per ogni task
          return `- ${t.title} ${desc}`.trim();
      }).join('\n');

      navigator.clipboard.writeText(text);
      alert(`${selectedTasks.length} task copiati negli appunti.`);
      setSelectedTaskIds(new Set());
  };

  const requestBulkDelete = () => {
      setConfirmModal({
          isOpen: true,
          count: selectedTaskIds.size,
          onConfirm: performBulkDelete
      });
  };

  const performBulkDelete = async () => {
        const ids = Array.from(selectedTaskIds);
        
        if (isFirebaseConfigured && db) {
            try {
                // Batch delete for robustness in Firestore
                const batch = writeBatch(db);
                ids.forEach(id => {
                    const ref = doc(db!, "tasks", id);
                    batch.update(ref, { deletedAt: Date.now() }); // Soft delete via Batch
                });
                await batch.commit();
            } catch(e) {
                console.error("Bulk delete error", e);
                alert("Errore durante l'eliminazione massiva.");
            }
        } else {
            // Local - Efficient bulk update logic
            const updated = tasks.map(t => selectedTaskIds.has(t.id) ? { ...t, deletedAt: Date.now() } : t);
            saveLocalTasks(updated);
        }
        // Pulisci selezione SOLO alla fine
        setSelectedTaskIds(new Set());
        setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const handleBulkStatusChange = async (newStatus: TaskStatus) => {
      const ids = Array.from(selectedTaskIds);
      
      if (isFirebaseConfigured && db) {
          const batch = writeBatch(db);
          ids.forEach(id => {
              const ref = doc(db!, "tasks", id);
              batch.update(ref, { status: newStatus });
          });
          await batch.commit();
      } else {
          const updated = tasks.map(t => selectedTaskIds.has(t.id) ? { ...t, status: newStatus } : t);
          saveLocalTasks(updated);
      }
      setSelectedTaskIds(new Set());
  };


  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addTask(newTaskTitle, newTaskDesc);
    setNewTaskTitle('');
    setNewTaskDesc('');
    if (titleTextareaRef.current) {
        titleTextareaRef.current.style.height = 'auto';
        titleTextareaRef.current.focus();
    }
  };

  const handleClearInput = () => {
      setNewTaskTitle('');
      setNewTaskDesc('');
      if (titleTextareaRef.current) {
          titleTextareaRef.current.style.height = 'auto';
          titleTextareaRef.current.focus();
      }
  };

  const generateAiTasks = async () => {
    if (!activeProjectId || !aiPrompt.trim() || !user) return;
    setIsAiLoading(true);
    try {
      const generated = await generateTasksFromInput(String(aiPrompt), String(activeProjectId));
      
      if (isFirebaseConfigured && db) {
          const promises = generated.map(t => addDoc(collection(db!, "tasks"), {
            userId: user.uid,
            projectId: activeProjectId || "",
            title: t.title || "Untitled Task",
            description: t.description || "",
            status: TaskStatus.TODO,
            priority: TaskPriority.MEDIUM, // Default MEDIUM
            createdAt: Date.now()
          }));
          await Promise.all(promises);
      } else {
          // Local Generation
          const newTasks: Task[] = generated.map(t => ({
             id: generateId(),
             userId: user.uid,
             projectId: activeProjectId || "",
             title: t.title || "Untitled Task",
             description: t.description || "",
             status: TaskStatus.TODO,
             priority: TaskPriority.MEDIUM, // Default MEDIUM
             createdAt: Date.now()
          }));
          saveLocalTasks([...tasks, ...newTasks]);
      }
      
      setAiPrompt('');
      setAiModalOpen(false);
    } catch (error: any) {
      console.error(error);
      alert("Errore durante la generazione dei task.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- UI Helpers ---

  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = titleTextareaRef.current.scrollHeight + 'px';
    }
  }, [newTaskTitle]);

  const activeTasks = useMemo(() => {
    const priorityWeight = { [TaskPriority.HIGH]: 3, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 1 };
    const query = searchQuery.trim().toLowerCase();

    return tasks
        .filter(t => {
            const matchesProject = t.projectId === activeProjectId && !t.deletedAt;
            if (!matchesProject) return false;
            if (!query) return true;
            return (
                t.title.toLowerCase().includes(query) || 
                (t.description && t.description.toLowerCase().includes(query))
            );
        })
        .sort((a, b) => {
            const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
            if (pDiff !== 0) return pDiff;
            return a.title.localeCompare(b.title);
        });
  }, [tasks, activeProjectId, searchQuery]);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);

  const cycleStatus = (task: Task) => {
    const map: Record<TaskStatus, TaskStatus> = {
      [TaskStatus.TODO]: TaskStatus.TEST,
      [TaskStatus.TEST]: TaskStatus.DONE,
      [TaskStatus.DONE]: TaskStatus.TODO
    };
    updateTask(task.id, { status: map[task.status] });
  };

  const cyclePriority = (task: Task) => {
    const map: Record<TaskPriority, TaskPriority> = {
      [TaskPriority.LOW]: TaskPriority.MEDIUM,
      [TaskPriority.MEDIUM]: TaskPriority.HIGH,
      [TaskPriority.HIGH]: TaskPriority.LOW
    };
    updateTask(task.id, { priority: map[task.priority] });
  };

  const saveEditedTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim()) return;
    const { id, ...data } = editingTask;
    updateTask(id, data);
    setEditingTask(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); 
      document.getElementById('newTaskDesc')?.focus();
    }
  };

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId) {
      updateTask(draggedTaskId, { status: targetStatus });
      setDraggedTaskId(null);
    }
  };

  const toggleGroup = (status: TaskStatus) => {
      setCollapsedGroups(prev => ({...prev, [status]: !prev[status]}));
  };

  // --- Rendering ---

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-background text-primary"><Loader2 className="animate-spin" size={48} /></div>;
  }

  if (!user) {
    return <LoginScreen onMockLogin={handleMockLogin} />;
  }

  const renderKanbanColumn = (status: TaskStatus, title: string, colorClass: string, borderColorClass: string) => {
    const colTasks = activeTasks.filter(t => t.status === status);
    return (
      <div 
        className="flex-1 min-w-[300px] flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-800/50 transition-colors"
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, status)}
      >
        <div className={`p-4 border-b ${borderColorClass} flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur-md rounded-t-xl z-10`}>
          <div className="flex items-center gap-2">
            <h3 className={`font-bold ${colorClass} text-sm uppercase tracking-wide`}>{title}</h3>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">{colTasks.length}</span>
        </div>
        <div className="p-3 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
          {colTasks.map(task => (
            <TaskItem 
              key={task.id}
              task={task}
              viewMode="KANBAN"
              isSelected={selectedTaskIds.has(task.id)}
              onToggleSelection={() => toggleTaskSelection(task.id)}
              onCycleStatus={cycleStatus}
              onCyclePriority={cyclePriority}
              onUpdateTitle={(t, val) => updateTask(t.id, { title: val })}
              onUpdateDescription={(t, val) => updateTask(t.id, { description: val })}
              onEdit={setEditingTask}
              onDelete={deleteTask}
              onDragStart={onDragStart}
            />
          ))}
          {colTasks.length === 0 && <div className="h-24 border-2 border-dashed border-slate-800 rounded-lg flex items-center justify-center text-slate-700 text-xs pointer-events-none">Trascina qui i task</div>}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const groups = [
        { status: TaskStatus.TODO, label: 'DA FARE', color: 'text-slate-200', border: 'border-slate-600' },
        { status: TaskStatus.TEST, label: 'DA TESTARE', color: 'text-orange-400', border: 'border-orange-700' },
        { status: TaskStatus.DONE, label: 'COMPLETATO', color: 'text-green-400', border: 'border-green-700' }
    ];

    return (
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        {groups.map(group => {
          const groupTasks = activeTasks.filter(t => t.status === group.status);
          const isCollapsed = collapsedGroups[group.status];
          
          return (
            <div 
                key={group.status} 
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, group.status)}
                className="rounded-xl min-h-[50px]"
            >
              <h3 
                onClick={() => toggleGroup(group.status)}
                className={`text-sm font-bold ${group.color} uppercase tracking-wider mb-3 px-1 flex items-center gap-2 border-b ${group.border} pb-2 cursor-pointer hover:bg-slate-800/50 rounded-t transition-colors select-none`}
              >
                 {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                 {group.label} <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{groupTasks.length}</span>
              </h3>
              
              {!isCollapsed && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    {groupTasks.map(task => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        viewMode="LIST"
                        isSelected={selectedTaskIds.has(task.id)}
                        onToggleSelection={() => toggleTaskSelection(task.id)}
                        onCycleStatus={cycleStatus} 
                        onCyclePriority={cyclePriority}
                        onUpdateTitle={(t, val) => updateTask(t.id, { title: val })}
                        onUpdateDescription={(t, val) => updateTask(t.id, { description: val })}
                        onEdit={setEditingTask}
                        onDelete={deleteTask} 
                        onDragStart={onDragStart}
                      />
                    ))}
                    {groupTasks.length === 0 && <div className="text-slate-600 text-xs italic p-4 text-center border border-dashed border-slate-800 rounded-lg">Nessun task in questa lista. Trascina qui per spostare.</div>}
                  </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-slate-200 font-sans selection:bg-primary/30">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col overflow-hidden whitespace-nowrap z-20 absolute md:relative h-full shadow-xl`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 shrink-0">
           <div className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
             <FastTrackLogo className="w-6 h-6 rounded-md" iconSize={16} />
             FastTrack
           </div>
           <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <PanelLeftClose size={20}/>
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-xs font-semibold text-slate-500 mb-2 px-2 flex justify-between items-center">
            <span>PROGETTI</span>
            {projects.length === 0 && <span className="text-[10px] text-blue-400">Crea il primo!</span>}
          </div>
          <div className="space-y-1">
            {projects.map(p => (
              <div 
                key={p.id}
                onClick={() => { setActiveProjectId(p.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${activeProjectId === p.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'}`}
              >
                <span className="truncate flex-1">{p.name}</span>
                <button 
                  onClick={(e) => deleteProject(p.id, e)} 
                  className="opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 p-1.5 rounded transition-all z-20"
                  title="Elimina progetto"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-900/50 shrink-0 space-y-3">
           <form onSubmit={(e) => { e.preventDefault(); addProject(); }} className="flex gap-2">
             <input 
               type="text" 
               placeholder="Nuovo Progetto..." 
               value={newProjectInput}
               onChange={(e) => setNewProjectInput(e.target.value)}
               className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
             />
             <button type="submit" disabled={!newProjectInput.trim()} className="bg-slate-700 hover:bg-primary hover:text-white text-slate-300 p-1.5 rounded-md transition-colors disabled:opacity-50">
               <Plus size={16} />
             </button>
           </form>
           
           <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
             <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">
                  {user.email ? user.email[0].toUpperCase() : <UserIcon size={12} />}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-xs text-slate-400 truncate max-w-[100px]" title={user.email || ''}>{user.email}</span>
                    {!isFirebaseConfigured && <span className="text-[9px] text-orange-400 font-bold uppercase">Modalità Locale</span>}
                </div>
             </div>
             <div className="flex items-center">
                 <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-slate-500 hover:text-white p-1.5 rounded hover:bg-slate-800 transition-colors" 
                    title="Impostazioni"
                 >
                    <SettingsIcon size={14} />
                 </button>
                 <button 
                    onClick={handleLogout} 
                    className="text-slate-500 hover:text-white p-1.5 rounded hover:bg-slate-800 transition-colors" 
                    title="Logout"
                 >
                    <LogOut size={14} />
                 </button>
             </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        
        {/* Error Banner */}
        {dbError && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-3 text-red-400 text-xs font-medium animate-in slide-in-from-top-2">
            <ShieldAlert size={16} className="shrink-0" />
            <div className="flex-1">{dbError}</div>
          </div>
        )}

        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-background/80 backdrop-blur-md sticky top-0 z-50 shrink-0 gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg">
                <Menu size={20} />
              </button>
            )}
            
            {/* Project Switcher logic when sidebar is closed */}
            {!isSidebarOpen && projects.length > 0 ? (
                <div className="relative z-30">
                    <button 
                        onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                        className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-slate-800/50 transition-colors group"
                    >
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg shadow-sm flex items-center justify-center text-white font-bold text-xs">
                             {activeProject?.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-xs text-slate-500 font-medium leading-none mb-0.5">Progetto</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-lg text-slate-200 leading-none truncate max-w-[200px]">
                                    {activeProject?.name}
                                </span>
                                <ChevronDown size={14} className={`text-slate-500 transition-transform ${isProjectMenuOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {isProjectMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-20" onClick={() => setIsProjectMenuOpen(false)}></div>
                            <div className="absolute top-full left-0 mt-2 w-72 bg-surface border border-slate-700/50 rounded-xl shadow-2xl p-2 z-30 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                                 <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/50 mb-1">
                                    I tuoi progetti
                                 </div>
                                 <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                     {projects.map(p => (
                                         <button 
                                             key={p.id}
                                             onClick={() => { setActiveProjectId(p.id); setIsProjectMenuOpen(false); }}
                                             className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-between group/item ${activeProjectId === p.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-300 hover:bg-slate-800'}`}
                                         >
                                             <span className="truncate">{p.name}</span>
                                             {activeProjectId === p.id && <Check size={14} className="text-primary"/>}
                                         </button>
                                     ))}
                                 </div>
                                 <div className="border-t border-slate-700/50 mt-1 pt-1">
                                     <button 
                                        onClick={() => { setIsProjectMenuOpen(false); setIsSidebarOpen(true); setTimeout(() => (document.querySelector('input[placeholder="Nuovo Progetto..."]') as HTMLElement)?.focus(), 100); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                     >
                                        <Plus size={14} /> Crea nuovo progetto...
                                     </button>
                                 </div>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                // Normal view with editable title
                activeProject && editingProjectName !== null ? (
                   <form 
                      className="flex-1 max-w-md flex gap-2"
                      onSubmit={(e) => { e.preventDefault(); renameProject(editingProjectName); }}
                   >
                     <input 
                       autoFocus
                       type="text" 
                       value={editingProjectName} 
                       onChange={(e) => setEditingProjectName(e.target.value)}
                       onBlur={() => renameProject(editingProjectName)}
                       className="bg-slate-800 border border-primary rounded px-2 py-1 text-white font-bold text-lg w-full outline-none"
                     />
                   </form>
                ) : (
                  <div className="group flex items-center gap-3 overflow-hidden min-w-0">
                    <h1 className="text-xl font-bold text-white truncate">
                      {activeProject?.name || (projects.length > 0 ? "Seleziona un progetto" : "Crea un progetto")}
                    </h1>
                    {activeProject && (
                      <button 
                        onClick={() => setEditingProjectName(activeProject.name)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-primary transition-all shrink-0"
                        title="Rinomina Progetto"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                )
            )}
          </div>

          {activeProject && (
              <div className="relative flex-1 max-w-xs hidden sm:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca task..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-12 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-600"
                  />
                   {/* Shortcut Hint */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                     {!searchQuery ? (
                         <span className="text-[10px] text-slate-600 border border-slate-700 rounded px-1.5 py-0.5 font-mono flex items-center gap-0.5">
                            <Command size={8} /> K
                         </span>
                     ) : (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="text-slate-500 hover:text-white pointer-events-auto"
                        >
                            <X size={14} />
                        </button>
                     )}
                  </div>
              </div>
          )}

          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 shrink-0 ml-2">
            <button 
              onClick={() => setViewMode('LIST')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              title="Vista Lista"
            >
              <LayoutList size={18} />
            </button>
            <button 
              onClick={() => setViewMode('KANBAN')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'KANBAN' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              title="Vista Kanban"
            >
              <KanbanIcon size={18} />
            </button>
          </div>
        </header>

        {/* Mobile Search Bar (visible only on small screens) */}
        {activeProject && (
             <div className="sm:hidden px-4 pt-4 pb-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cerca task..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    />
                </div>
             </div>
        )}

        {/* Improved Input Area */}
        {activeProject && (
          <div className="p-4 md:p-6 pb-2 shrink-0 z-20">
            <div className="max-w-5xl mx-auto relative bg-surface border border-slate-700 rounded-xl shadow-lg p-3">
              <form onSubmit={handleQuickAdd} className="flex flex-col gap-2">
                <textarea
                  ref={titleTextareaRef}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Titolo Task (Enter per inviare)..."
                  rows={1}
                  className="w-full bg-slate-900/50 border-b border-transparent focus:border-primary/50 rounded-t px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none transition-all resize-none font-medium"
                />
                
                <div className="flex gap-2">
                    <textarea
                        id="newTaskDesc"
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.target.value)}
                        onKeyDown={(e) => {
                             if (e.key === 'Enter' && e.shiftKey) { /* Allow newline */ } 
                             else if (e.key === 'Enter') { e.preventDefault(); handleQuickAdd(e); }
                        }}
                        placeholder="Note aggiuntive (Shift+Enter per a capo)..."
                        rows={1}
                        className="flex-1 bg-slate-900/30 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none min-h-[38px]"
                    />
                    
                    {(newTaskTitle || newTaskDesc) && (
                        <button 
                            type="button"
                            onClick={handleClearInput}
                            className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium border border-transparent hover:border-slate-700"
                            title="Svuota campi"
                        >
                            <Eraser size={16} />
                        </button>
                    )}

                    <button 
                        type="button"
                        onClick={() => setAiModalOpen(true)}
                        className="px-3 py-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium border border-slate-700 hover:border-purple-500/30"
                        title="Genera con AI"
                    >
                        <Sparkles size={16} />
                    </button>
                    <button 
                        type="submit" 
                        disabled={!newTaskTitle.trim()}
                        className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-primary shadow-md flex items-center justify-center"
                    >
                        <Plus size={20} />
                    </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Content View */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 custom-scrollbar pb-24">
           {viewMode === 'LIST' ? (
             renderListView()
           ) : (
             <div className="h-full flex gap-4 overflow-x-auto pb-4 snap-x">
               {renderKanbanColumn(TaskStatus.TODO, 'Da Fare', 'text-slate-300', 'border-slate-600')}
               {renderKanbanColumn(TaskStatus.TEST, 'Da Testare', 'text-orange-400', 'border-orange-600')}
               {renderKanbanColumn(TaskStatus.DONE, 'Completati', 'text-green-400', 'border-green-600')}
             </div>
           )}
        </div>
        
        {/* Bulk Action Bar */}
        {selectedTaskIds.size > 0 && (
          // FIX CRITICO: Rimosso onMouseDown={(e) => e.stopPropagation()} da qui
          // Altrimenti il click sui pulsanti figli non funziona correttamente in alcuni browser
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-2 px-4 flex items-center gap-3 animate-in slide-in-from-bottom-6 z-40 max-w-[90vw] no-drag">
              <div className="flex items-center gap-2 border-r border-slate-700 pr-3 mr-1">
                  <div className="bg-primary text-white text-xs font-bold rounded-md w-6 h-6 flex items-center justify-center">
                      {selectedTaskIds.size}
                  </div>
                  <span className="text-xs font-medium text-slate-300 hidden sm:inline">Selezionati</span>
              </div>

              <button 
                  onClick={handleBulkCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Copia lista titoli (per Excel/Chat)"
              >
                  <Copy size={14} />
                  <span className="hidden sm:inline">Copia</span>
              </button>

              <div className="h-6 w-px bg-slate-700/50"></div>

              <div className="relative group">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                      <ListTodo size={14} />
                      <span className="hidden sm:inline">Stato</span>
                      <ChevronUp size={12} className="text-slate-500" />
                  </button>
                  <div className="absolute bottom-full left-0 mb-2 w-32 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden hidden group-hover:block animate-in fade-in zoom-in-95">
                      <button onClick={() => handleBulkStatusChange(TaskStatus.TODO)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-300 flex items-center gap-2"><Circle size={10}/> Da Fare</button>
                      <button onClick={() => handleBulkStatusChange(TaskStatus.TEST)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-orange-400 flex items-center gap-2"><Clock size={10}/> Test</button>
                      <button onClick={() => handleBulkStatusChange(TaskStatus.DONE)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-green-400 flex items-center gap-2"><CheckCircle2 size={10}/> Fatto</button>
                  </div>
              </div>

              <div className="h-6 w-px bg-slate-700/50"></div>

              <button 
                  type="button"
                  // CRITICAL FIX: Stop propagation to prevent drag events or losing focus
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    requestBulkDelete();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                  <Trash2 size={14} />
                  <span className="hidden sm:inline">Elimina</span>
              </button>
              
              <button 
                onClick={() => setSelectedTaskIds(new Set())}
                className="ml-2 text-slate-500 hover:text-white"
              >
                  <X size={16} />
              </button>
          </div>
        )}

        {/* Modals */}
        <FirebaseConfigModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            onSave={saveConfig}
            dataToBackup={{ projects, tasks }}
            userId={user?.uid}
        />

        {confirmModal.isOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-3">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">Sei sicuro?</h3>
                        <p className="text-sm text-slate-400">
                            Stai per eliminare <strong>{confirmModal.count}</strong> task. 
                            Questa azione non può essere annullata.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setConfirmModal({...confirmModal, isOpen: false})}
                            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                        >
                            Annulla
                        </button>
                        <button 
                            onClick={confirmModal.onConfirm}
                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors"
                        >
                            Elimina
                        </button>
                    </div>
                </div>
            </div>
        )}

        {aiModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                 <h2 className="text-lg font-bold text-white flex items-center gap-2">
                   <Sparkles size={20} className="text-purple-500" />
                   Assistente AI
                 </h2>
                 <button onClick={() => setAiModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-5">
                <p className="text-slate-400 text-sm mb-4">
                  Descrivi cosa vuoi realizzare (es. "Voglio una landing page con form di contatto e footer") e l'AI genererà i task necessari.
                </p>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Descrivi il tuo obiettivo qui..."
                  className="w-full h-32 bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-purple-500 resize-none text-sm"
                ></textarea>
                <div className="mt-4 flex justify-end gap-3">
                  <button onClick={() => setAiModalOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annulla</button>
                  <button 
                    onClick={generateAiTasks}
                    disabled={isAiLoading || !aiPrompt.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAiLoading ? <><Loader2 className="animate-spin" size={16} />Generazione...</> : <><Sparkles size={16} />Genera Task</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingTask && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-white">Modifica Task Completo</h3>
                  <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                   <form id="editTaskForm" onSubmit={saveEditedTask} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">TITOLO TASK</label>
                        <textarea 
                          value={editingTask.title}
                          onChange={(e) => setEditingTask({...editingTask, title: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-primary min-h-[60px] resize-y"
                          placeholder="Titolo..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">NOTE AGGIUNTIVE</label>
                        <textarea 
                          value={editingTask.description || ''}
                          onChange={(e) => setEditingTask({...editingTask, description: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-primary min-h-[120px] resize-y"
                          placeholder="Dettagli tecnici..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">STATO</label>
                            <div className="flex flex-col gap-2">
                            {[TaskStatus.TODO, TaskStatus.TEST, TaskStatus.DONE].map(status => (
                                <button
                                    type="button"
                                    key={status}
                                    onClick={() => setEditingTask({...editingTask, status})}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all flex items-center justify-between ${editingTask.status === status ? 'bg-primary/20 border-primary text-primary' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    {status}
                                    {editingTask.status === status && <CheckCircle2 size={14}/>}
                                </button>
                            ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">PRIORITÀ</label>
                            <div className="flex flex-col gap-2">
                            {[TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH].map(p => (
                                <button
                                    type="button"
                                    key={p}
                                    onClick={() => setEditingTask({...editingTask, priority: p})}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all flex items-center justify-between ${editingTask.priority === p ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    {p}
                                    {editingTask.priority === p && <CheckCircle2 size={14}/>}
                                </button>
                            ))}
                            </div>
                          </div>
                      </div>
                   </form>
                </div>
                <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900 rounded-b-2xl">
                   <button type="button" onClick={() => setEditingTask(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Annulla</button>
                   <button 
                     form="editTaskForm"
                     type="submit" 
                     className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                   >
                     <Save size={16} /> Salva Modifiche
                   </button>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}