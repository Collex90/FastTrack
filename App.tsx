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
  Eraser,
  FolderPlus,
  LayoutTemplate,
  MoreVertical,
  Filter,
  Eye,
  EyeOff,
  FileText,
  AlignLeft
} from 'lucide-react';
import { Project, Task, TaskStatus, TaskPriority, ViewMode, Section } from './types';
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
        return crypto.randomUUID() as string;
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Component for Smooth Collapsing Animation
const SmoothCollapse = ({ isOpen, children, className = "" }: { isOpen: boolean, children?: React.ReactNode, className?: string }) => {
    return (
        <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'} ${className}`}>
            <div className="overflow-hidden">
                {children}
            </div>
        </div>
    );
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
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-primary transition-colors select-none leading-none py-0.5"
                >
                    <ChevronDown size={12} />
                    Mostra note ({text.split('\n')[0].substring(0, 30)}...)
                </button>
            )}
            <SmoothCollapse isOpen={isOpen}>
                <div 
                    className="bg-slate-900/50 rounded p-2 border border-slate-800/50 w-full cursor-auto no-drag mt-1"
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
            </SmoothCollapse>
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
            className={`mr-3 mt-1 cursor-pointer transition-colors no-drag shrink-0 ${isSelected ? 'text-primary' : 'text-slate-600 hover:text-slate-400'}`}
         >
             {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
         </div>

         <div className="flex-1 min-w-0">
            <InlineEditableText 
            text={task.title} 
            isDone={task.status === TaskStatus.DONE} 
            onSave={(val) => onUpdateTitle(task, val)} 
            className="text-sm font-medium leading-normal py-0.5"
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

      <div className={`flex items-center justify-between shrink-0 ${viewMode === 'LIST' ? 'gap-3 mt-2 md:mt-0.5 md:self-start md:ml-4' : 'w-full pt-2 border-t border-slate-700/50 mt-1.5'}`}
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
              className="p-1 text-slate-500 hover:text-green-400 hover:bg-slate-700 rounded transition-colors flex items-center justify-center"
              title="Copia Titolo e Note (Inline)"
          >
              {isCopied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
          </button>
          <button 
              onClick={() => onEdit(task)}
              className="p-1 text-slate-500 hover:text-primary hover:bg-slate-700 rounded transition-colors flex items-center justify-center"
              title="Modifica dettaglio"
          >
              <Pencil size={13} />
          </button>
          <button 
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} 
              className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors flex items-center justify-center"
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
                    const batchSize = 450; 
                    let batch = writeBatch(db);
                    let count = 0;

                    const commitBatch = async () => {
                        await batch.commit();
                        batch = writeBatch(db);
                        count = 0;
                    };

                    for (const p of projectsToRestore) {
                        const ref = doc(db, "projects", p.id);
                        batch.set(ref, { ...p, userId: userId }, { merge: true });
                        count++;
                        if (count >= batchSize) await commitBatch();
                    }

                    for (const t of tasksToRestore) {
                        const ref = doc(db, "tasks", t.id);
                        batch.set(ref, { ...t, userId: userId }, { merge: true });
                        count++;
                        if (count >= batchSize) await commitBatch();
                    }

                    if (count > 0) await commitBatch();

                } else {
                    const currentProjects = JSON.parse(localStorage.getItem('ft_projects_local') || '[]');
                    const currentTasks = JSON.parse(localStorage.getItem('ft_tasks_local') || '[]');
                    
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
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-1">Connessione Firebase</h3>
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <ClipboardPaste size={14} /> Incolla Configurazione Rapida
                            </label>
                            <textarea
                                value={pasteInput}
                                onChange={(e) => setPasteInput(e.target.value)}
                                placeholder={`const firebaseConfig = {\n  apiKey: "...",\n  ... \n};`}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:border-primary focus:outline-none h-20 resize-none mb-2"
                            />
                            <button
                                onClick={handlePasteParse}
                                disabled={!pasteInput.trim()}
                                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded border border-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <ArrowDown size={12} /> Analizza ed Estrai Dati
                            </button>
                            {parseSuccess && <div className="mt-2 text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={12} /> Campi compilati!</div>}
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {Object.keys(config).map((key) => (
                                <div key={key}>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{key}</label>
                                    <input type="text" name={key} value={(config as any)[key]} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-primary focus:outline-none"/>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-1">Backup e Ripristino</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleBackup} className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-900 border border-slate-700 hover:border-primary/50 hover:bg-slate-800 rounded-xl transition-all group">
                                <div className="p-2 bg-slate-800 group-hover:bg-primary/20 rounded-full text-slate-400 group-hover:text-primary transition-colors"><Download size={20} /></div>
                                <span className="text-xs font-bold text-slate-300">Scarica Backup</span>
                            </button>
                            <button onClick={handleRestoreClick} disabled={backupLoading} className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-900 border border-slate-700 hover:border-orange-500/50 hover:bg-slate-800 rounded-xl transition-all group disabled:opacity-50">
                                <div className="p-2 bg-slate-800 group-hover:bg-orange-500/20 rounded-full text-slate-400 group-hover:text-orange-500 transition-colors">{backupLoading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}</div>
                                <span className="text-xs font-bold text-slate-300">Ripristina Dati</span>
                            </button>
                            <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                        </div>
                        {restoreStatus && <div className={`text-xs p-2 rounded border flex items-center gap-2 ${restoreStatus.includes('Errore') ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}><RefreshCw size={12} className={backupLoading ? "animate-spin" : ""} />{restoreStatus}</div>}
                    </div>
                </div>
                <div className="mt-6 flex gap-3 shrink-0 pt-4 border-t border-slate-800">
                     {isFirebaseConfigured && <button onClick={resetConfig} className="px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors">Reset</button>}
                     <button onClick={() => onSave(config)} disabled={!config.apiKey} className="flex-1 bg-primary hover:bg-blue-600 text-white font-bold py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">Salva e Riavvia</button>
                </div>
             </div>
        </div>
    );
};

// --- Login/Register Screen ---
const LoginScreen = ({ onMockLogin }: { onMockLogin: () => void }) => {
    // [Login Screen Content - Copied exactly as before]
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        if (!isFirebaseConfigured) {
            setTimeout(() => { onMockLogin(); setLoading(false); }, 800);
            return;
        }
        if (!auth) { setError("Errore configurazione auth."); setLoading(false); return; }
        try {
            if (isRegister) await createUserWithEmailAndPassword(auth, email, password);
            else await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            console.error(err);
            let msg = "Si è verificato un errore.";
            if (err.code === 'auth/invalid-email') msg = "Indirizzo email non valido.";
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
                  <span>Firebase non è configurato. L'accesso avverrà in <strong>Modalità Locale</strong>.</span>
              </div>
          )}

          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2"><AlertCircle size={14} />{error}</div>}

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
            <button type="button" onClick={() => { setIsRegister(!isRegister); setError(null); }} className="text-sm text-slate-400 hover:text-white transition-colors">{isRegister ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}</button>
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
  const user = isFirebaseConfigured ? fbUser : mockUser;

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  
  // Collapsed Groups State
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
      [TaskStatus.TODO]: false,
      [TaskStatus.TEST]: false,
      [TaskStatus.DONE]: true
  });
  
  // --- New States for Enhanced Views ---
  const [groupByContainer, setGroupByContainer] = useState(true);
  
  // MULTI-SELECT CONTAINER FILTER STATE
  const [selectedContainerIds, setSelectedContainerIds] = useState<Set<string>>(new Set());
  const [isContainerFilterOpen, setIsContainerFilterOpen] = useState(false);
  const [containerDropdownSearch, setContainerDropdownSearch] = useState('');

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  // State for collapsed statuses WITHIN sections (Default DONE collapsed)
  const [sectionStatusCollapsed, setSectionStatusCollapsed] = useState<Record<string, boolean>>({});

  const [dbError, setDbError] = useState<string | null>(null);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [showTaskDescInput, setShowTaskDescInput] = useState(false);
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);

  const [newProjectInput, setNewProjectInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  
  // Sections (Container) State UI
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  // New Section Creation Modal State
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [sectionModalName, setSectionModalName] = useState('');
  
  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, count: number, onConfirm: () => void}>({
      isOpen: false, count: 0, onConfirm: () => {}
  });
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // --- Search Shortcut Effect ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.altKey && e.key.toLowerCase() === 'k') {
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
        setAuthLoading(false);
    }
  }, []);

  // --- Selection Clear ---
  useEffect(() => {
    setSelectedTaskIds(new Set());
    setSearchQuery('');
    setSelectedContainerIds(new Set()); // Reset container filter on project change
  }, [activeProjectId, viewMode]);

  // --- Data Sync ---
  useEffect(() => {
    if (!user) { setProjects([]); return; }
    if (isFirebaseConfigured && db) {
        setDbError(null);
        const q = query(collection(db, "projects"), where("userId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
            projData.sort((a, b) => {
                 if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
                 return a.createdAt - b.createdAt;
            });
            setProjects(projData);
            if (projData.length > 0 && !activeProjectId) setActiveProjectId(projData[0].id);
            else if (projData.length === 0) setActiveProjectId(null);
          }, (error) => {
            console.error("Firestore Projects Error:", error);
            if (error.code === 'permission-denied') setDbError("Permesso negato.");
          });
        return () => unsubscribe();
    } else {
        const saved = localStorage.getItem(`ft_projects_local`);
        if (saved) {
            const parsed = JSON.parse(saved) as Project[];
            if (Array.isArray(parsed)) {
                parsed.sort((a, b) => {
                     if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
                     return a.createdAt - b.createdAt;
                });
                setProjects(parsed);
                if (parsed.length > 0 && !activeProjectId) setActiveProjectId(parsed[0].id);
            }
        }
    }
  }, [user, isFirebaseConfigured]); 

  useEffect(() => {
    if (!user) { setTasks([]); return; }
    if (isFirebaseConfigured && db) {
        const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
            setTasks(taskData);
          });
        return () => unsubscribe();
    } else {
        const saved = localStorage.getItem(`ft_tasks_local`);
        if (saved) {
            const parsed = JSON.parse(saved) as Task[];
            if (Array.isArray(parsed)) setTasks(parsed);
        }
    }
  }, [user, isFirebaseConfigured]);

  const saveLocalProjects = (newProjects: Project[]) => {
      setProjects(newProjects);
      localStorage.setItem(`ft_projects_local`, JSON.stringify(newProjects));
  };
  const saveLocalTasks = (newTasks: Task[]) => {
      setTasks(newTasks);
      localStorage.setItem(`ft_tasks_local`, JSON.stringify(newTasks));
  };

  // --- Project Actions ---
  const handleMockLogin = () => setMockUser({ uid: 'local-user', email: 'local@demo.com', displayName: 'Utente Locale' } as any);
  const handleLogout = () => isFirebaseConfigured && auth ? signOut(auth) : setMockUser(null);

  const addProject = async () => {
    if (!newProjectInput.trim() || !user) return;
    const maxOrder = projects.length > 0 ? Math.max(...projects.map(p => p.order || 0)) : 0;
    const newProjData = { userId: user.uid, name: newProjectInput.trim(), createdAt: Date.now(), order: maxOrder + 1, sections: [] };
    if (isFirebaseConfigured && db) await addDoc(collection(db, "projects"), newProjData);
    else {
        const newProj: Project = { id: generateId(), ...newProjData };
        saveLocalProjects([...projects, newProj]);
        setActiveProjectId(newProj.id);
    }
    setNewProjectInput('');
  };

  const renameProject = async (newName: string) => {
    if (!activeProjectId || !newName.trim()) return;
    if (isFirebaseConfigured && db) await updateDoc(doc(db, "projects", activeProjectId), { name: newName.trim() });
    else saveLocalProjects(projects.map(p => p.id === activeProjectId ? { ...p, name: newName.trim() } : p));
    setEditingProjectName(null);
  };

  const deleteProject = async (projId: string, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!window.confirm('Sei sicuro? Questo eliminerà il progetto e TUTTI i suoi task.')) return;
    if (isFirebaseConfigured && db) {
        await deleteDoc(doc(db, "projects", projId));
        tasks.filter(t => t.projectId === projId).forEach(async (t) => await deleteDoc(doc(db, "tasks", t.id)));
    } else {
        const updatedProjs = projects.filter(p => p.id !== projId);
        saveLocalProjects(updatedProjs);
        if (activeProjectId === projId) setActiveProjectId(updatedProjs.length > 0 ? updatedProjs[0].id : null);
        saveLocalTasks(tasks.filter(t => t.projectId !== projId));
    }
  };

  // --- Section Actions ---
  const addSection = () => {
      if (!activeProject || !user) return;
      setSectionModalName('');
      setIsSectionModalOpen(true);
  };

  const handleCreateSection = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeProject || !user || !sectionModalName.trim()) return;
      
      const currentSections = activeProject.sections || [];
      const newSection: Section = {
          id: generateId(),
          name: sectionModalName.trim(),
          order: currentSections.length
      };
      
      const updatedSections = [...currentSections, newSection];
      
      if (isFirebaseConfigured && db) {
          await updateDoc(doc(db, "projects", activeProject.id), { sections: updatedSections });
      } else {
          saveLocalProjects(projects.map(p => p.id === activeProject.id ? { ...p, sections: updatedSections } : p));
      }
      setIsSectionModalOpen(false);
      setSectionModalName('');
  };

  const renameSection = async (sectionId: string, newName: string) => {
      if (!activeProject) return;
      const updatedSections = (activeProject.sections || []).map(s => s.id === sectionId ? {...s, name: newName} : s);
      if (isFirebaseConfigured && db) {
          await updateDoc(doc(db, "projects", activeProject.id), { sections: updatedSections });
      } else {
          saveLocalProjects(projects.map(p => p.id === activeProject.id ? { ...p, sections: updatedSections } : p));
      }
      setEditingSectionId(null);
  };

  const deleteSection = async (sectionId: string) => {
      if (!activeProject || !confirm("Eliminare questa sezione? I task rimarranno ma saranno 'Senza Sezione'.")) return;
      const updatedSections = (activeProject.sections || []).filter(s => s.id !== sectionId);
      
      if (isFirebaseConfigured && db) {
          const batch = writeBatch(db);
          // Update Project
          batch.update(doc(db, "projects", activeProject.id), { sections: updatedSections });
          // Update Tasks (remove sectionId)
          tasks.filter(t => t.projectId === activeProject.id && t.sectionId === sectionId).forEach(t => {
              batch.update(doc(db!, "tasks", t.id), { sectionId: null }); // or deleteField() if prefer
          });
          await batch.commit();
      } else {
          saveLocalProjects(projects.map(p => p.id === activeProject.id ? { ...p, sections: updatedSections } : p));
          saveLocalTasks(tasks.map(t => t.projectId === activeProject.id && t.sectionId === sectionId ? { ...t, sectionId: undefined } : t));
      }
  };

  // --- Task Actions ---

  const addTask = async (title: string, desc: string, sectionId?: string) => {
    if (!activeProjectId || !title.trim() || !user) return;
    const newTaskData = {
        userId: user.uid,
        projectId: activeProjectId,
        sectionId: sectionId, // Assign to section if provided
        title: title.trim(),
        description: desc.trim(),
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        createdAt: Date.now()
    };
    if (isFirebaseConfigured && db) await addDoc(collection(db, "tasks"), newTaskData);
    else saveLocalTasks([...tasks, { id: generateId(), ...newTaskData }]);
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (isFirebaseConfigured && db) await updateDoc(doc(db, "tasks", taskId), updates);
    else saveLocalTasks(tasks.map(t => t.id === taskId ? { ...t, ...updates } : t));
  };

  const deleteTask = async (taskId: string) => updateTask(taskId, { deletedAt: Date.now() });

  const toggleTaskSelection = (taskId: string) => {
      const newSet = new Set(selectedTaskIds);
      if (newSet.has(taskId)) newSet.delete(taskId);
      else newSet.add(taskId);
      setSelectedTaskIds(newSet);
  };

  const toggleContainerSelection = (sectionId: string) => {
      const newSet = new Set(selectedContainerIds);
      if (newSet.has(sectionId)) newSet.delete(sectionId);
      else newSet.add(sectionId);
      setSelectedContainerIds(newSet);
  };

  const handleBulkCopy = () => {
      const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id));
      if (selectedTasks.length === 0) return;
      const text = selectedTasks.map(t => {
          const desc = (t.description || '').replace(/[\r\n]+/g, ' ').trim();
          return `- ${t.title} ${desc}`.trim();
      }).join('\n');
      navigator.clipboard.writeText(text);
      alert(`${selectedTasks.length} task copiati.`);
      setSelectedTaskIds(new Set());
  };

  const requestBulkDelete = () => setConfirmModal({ isOpen: true, count: selectedTaskIds.size, onConfirm: performBulkDelete });

  const performBulkDelete = async () => {
        const ids = Array.from(selectedTaskIds);
        if (isFirebaseConfigured && db) {
            try {
                const batch = writeBatch(db);
                ids.forEach(id => {
                    const ref = doc(db!, "tasks", id);
                    batch.update(ref, { deletedAt: Date.now() });
                });
                await batch.commit();
            } catch(e) { console.error("Bulk delete error", e); }
        } else {
            saveLocalTasks(tasks.map(t => selectedTaskIds.has(t.id) ? { ...t, deletedAt: Date.now() } : t));
        }
        setSelectedTaskIds(new Set());
        setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const handleBulkStatusChange = async (newStatus: TaskStatus) => {
      const ids = Array.from(selectedTaskIds);
      if (isFirebaseConfigured && db) {
          const batch = writeBatch(db);
          ids.forEach(id => batch.update(doc(db!, "tasks", id), { status: newStatus }));
          await batch.commit();
      } else saveLocalTasks(tasks.map(t => selectedTaskIds.has(t.id) ? { ...t, status: newStatus } : t));
      setSelectedTaskIds(new Set());
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    // Default to targetSectionId or null
    const finalSectionId = targetSectionId || undefined;
    addTask(newTaskTitle, newTaskDesc, finalSectionId);
    handleClearInput();
  };

  const handleClearInput = () => {
      setNewTaskTitle(''); 
      setNewTaskDesc('');
      setTargetSectionId(null);
      if (newTaskInputRef.current) { newTaskInputRef.current.focus(); }
  };
  
  const handleAddToSection = (sectionId: string) => {
      setTargetSectionId(sectionId);
      if (newTaskInputRef.current) {
          newTaskInputRef.current.focus();
          newTaskInputRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  };

  const generateAiTasks = async () => {
    if (!activeProjectId || !aiPrompt.trim() || !user) return;
    setIsAiLoading(true);
    try {
      const generated = await generateTasksFromInput(String(aiPrompt), String(activeProjectId));
      // By default, AI tasks go to no section (Backlog/Uncategorized)
      if (isFirebaseConfigured && db) {
          const promises = generated.map(t => addDoc(collection(db!, "tasks"), {
            userId: user.uid, projectId: activeProjectId || "", title: t.title || "Untitled", description: t.description || "",
            status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, createdAt: Date.now()
          }));
          await Promise.all(promises);
      } else {
          const newTasks: Task[] = generated.map(t => ({
             id: generateId(), userId: user.uid, projectId: activeProjectId || "", title: t.title || "Untitled", description: t.description || "",
             status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, createdAt: Date.now()
          }));
          saveLocalTasks([...tasks, ...newTasks]);
      }
      setAiPrompt(''); setAiModalOpen(false);
    } catch (error: any) { console.error(error); alert("Errore generazione task."); } finally { setIsAiLoading(false); }
  };

  // --- Drag & Drop ---
  const onProjectDragStart = (e: React.DragEvent, projId: string) => {
     e.dataTransfer.setData('projectId', projId); e.dataTransfer.setData('type', 'PROJECT'); e.dataTransfer.effectAllowed = 'move';
  };
  const onProjectDragOver = (e: React.DragEvent) => {
      if (e.dataTransfer.getData('type') === 'PROJECT') e.preventDefault(); 
  };
  const handleProjectDrop = async (e: React.DragEvent, targetProjId: string) => {
      const sourceId = e.dataTransfer.getData('projectId');
      if (e.dataTransfer.getData('type') !== 'PROJECT' || sourceId === targetProjId) return;
      const newProjects = [...projects];
      const sourceIndex = newProjects.findIndex(p => p.id === sourceId);
      const targetIndex = newProjects.findIndex(p => p.id === targetProjId);
      if (sourceIndex < 0 || targetIndex < 0) return;
      const [moved] = newProjects.splice(sourceIndex, 1);
      newProjects.splice(targetIndex, 0, moved);
      const updatedProjects = newProjects.map((p, index) => ({ ...p, order: index }));
      setProjects(updatedProjects);
      if (isFirebaseConfigured && db) {
          const batch = writeBatch(db);
          updatedProjects.forEach(p => batch.update(doc(db!, "projects", p.id), { order: p.order }));
          await batch.commit();
      } else saveLocalProjects(updatedProjects);
  };

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId); e.dataTransfer.setData('type', 'TASK'); e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  
  // Handle dropping a task onto a Section (Container)
  const onDropToSection = (e: React.DragEvent, sectionId: string | undefined) => {
      e.preventDefault();
      if (draggedTaskId) {
          // If sectionId is undefined, it means "Uncategorized"
          const updates: any = { sectionId: sectionId || null };
          updateTask(draggedTaskId, updates);
          setDraggedTaskId(null);
      }
  };

  // New: Handle dropping a task onto a specific status inside a Section
  const onDropToSectionAndStatus = (e: React.DragEvent, sectionId: string | undefined | null, targetStatus: TaskStatus) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling to onDropToSection
    if (draggedTaskId) {
        updateTask(draggedTaskId, { 
            sectionId: sectionId || null, 
            status: targetStatus 
        });
        setDraggedTaskId(null);
    }
  };

  // Handle dropping a task onto a Status (Kanban or Classic List)
  const onDropToStatus = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId) {
      updateTask(draggedTaskId, { status: targetStatus });
      setDraggedTaskId(null);
    }
  };

  const toggleGroup = (key: string) => setCollapsedGroups(prev => ({...prev, [key]: !prev[key]}));

  const toggleSection = (id: string) => {
      const newSet = new Set(collapsedSections);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setCollapsedSections(newSet);
  };

  const toggleSectionStatus = (secId: string, status: string) => {
      const key = `${secId}-${status}`;
      setSectionStatusCollapsed(prev => ({...prev, [key]: !isSectionStatusCollapsed(secId, status)}));
  };

  const isSectionStatusCollapsed = (secId: string, status: string) => {
      const key = `${secId}-${status}`;
      if (sectionStatusCollapsed[key] !== undefined) return sectionStatusCollapsed[key];
      // Default: DONE is collapsed, others open
      return status === TaskStatus.DONE;
  };

  // --- Rendering Helpers ---

  const activeTasks = useMemo(() => {
    const priorityWeight = { [TaskPriority.HIGH]: 3, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 1 };
    const queryStr = searchQuery.trim().toLowerCase();
    return tasks.filter(t => {
            if (t.projectId !== activeProjectId || t.deletedAt) return false;
            if (!queryStr) return true;
            return (t.title.toLowerCase().includes(queryStr) || (t.description && t.description.toLowerCase().includes(queryStr)));
        }).sort((a, b) => {
            const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
            if (pDiff !== 0) return pDiff;
            return a.title.localeCompare(b.title);
        });
  }, [tasks, activeProjectId, searchQuery]);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);

  const cycleStatus = (task: Task) => {
    const map: Record<TaskStatus, TaskStatus> = { [TaskStatus.TODO]: TaskStatus.TEST, [TaskStatus.TEST]: TaskStatus.DONE, [TaskStatus.DONE]: TaskStatus.TODO };
    updateTask(task.id, { status: map[task.status] });
  };
  const cyclePriority = (task: Task) => {
    const map: Record<TaskPriority, TaskPriority> = { [TaskPriority.LOW]: TaskPriority.MEDIUM, [TaskPriority.MEDIUM]: TaskPriority.HIGH, [TaskPriority.HIGH]: TaskPriority.LOW };
    updateTask(task.id, { priority: map[task.priority] });
  };

  const saveEditedTask = (e: React.FormEvent) => {
    e.preventDefault(); if (!editingTask || !editingTask.title.trim()) return;
    const { id, ...data } = editingTask; updateTask(id, data); setEditingTask(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('newTaskDesc')?.focus(); } };

  if (authLoading) return <div className="flex items-center justify-center min-h-screen bg-background text-primary"><Loader2 className="animate-spin" size={48} /></div>;
  if (!user) return <LoginScreen onMockLogin={handleMockLogin} />;

  const hasSections = activeProject?.sections && activeProject.sections.length > 0;

  // --- View Renderers ---

  const renderKanbanColumn = (status: TaskStatus, title: string, colorClass: string, borderColorClass: string) => {
    const colTasks = activeTasks.filter(t => t.status === status);
    return (
      <div className="flex-1 min-w-[300px] flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-800/50 transition-colors" onDragOver={onDragOver} onDrop={(e) => onDropToStatus(e, status)}>
        <div className={`p-4 border-b ${borderColorClass} flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur-md rounded-t-xl z-10`}>
          <div className="flex items-center gap-2"><h3 className={`font-bold ${colorClass} text-sm uppercase tracking-wide`}>{title}</h3></div>
          <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">{colTasks.length}</span>
        </div>
        <div className="p-3 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
          {colTasks.map(task => (
            <TaskItem key={task.id} task={task} viewMode="KANBAN" isSelected={selectedTaskIds.has(task.id)} onToggleSelection={() => toggleTaskSelection(task.id)} onCycleStatus={cycleStatus} onCyclePriority={cyclePriority} onUpdateTitle={(t, val) => updateTask(t.id, { title: val })} onUpdateDescription={(t, val) => updateTask(t.id, { description: val })} onEdit={setEditingTask} onDelete={deleteTask} onDragStart={onDragStart} />
          ))}
          {colTasks.length === 0 && <div className="h-24 border-2 border-dashed border-slate-800 rounded-lg flex items-center justify-center text-slate-700 text-xs pointer-events-none">Trascina qui i task</div>}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    
    // Check if we should render sections
    if (!hasSections || !groupByContainer) {
        // --- CLASSIC STATUS VIEW ---
        const groups = [
            { status: TaskStatus.TODO, label: 'DA FARE', color: 'text-slate-200', border: 'border-slate-600' },
            { status: TaskStatus.TEST, label: 'DA TESTARE', color: 'text-orange-400', border: 'border-orange-700' },
            { status: TaskStatus.DONE, label: 'COMPLETATO', color: 'text-green-400', border: 'border-green-700' }
        ];
        return (
          <div className="max-w-5xl mx-auto pb-20">
            <div className="space-y-8">
                {groups.map(group => {
                const groupTasks = activeTasks.filter(t => t.status === group.status);
                const isCollapsed = collapsedGroups[group.status];
                return (
                    <div key={group.status} onDragOver={onDragOver} onDrop={(e) => onDropToStatus(e, group.status)} className="rounded-xl min-h-[50px]">
                    <h3 onClick={() => toggleGroup(group.status)} className={`text-sm font-bold ${group.color} uppercase tracking-wider mb-3 px-1 flex items-center gap-2 border-b ${group.border} pb-2 cursor-pointer hover:bg-slate-800/50 rounded-t transition-colors select-none`}>
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        {group.label} <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{groupTasks.length}</span>
                    </h3>
                    <SmoothCollapse isOpen={!isCollapsed}>
                        <div className="space-y-2">
                            {groupTasks.map(task => (
                            <TaskItem key={task.id} task={task} viewMode="LIST" isSelected={selectedTaskIds.has(task.id)} onToggleSelection={() => toggleTaskSelection(task.id)} onCycleStatus={cycleStatus} onCyclePriority={cyclePriority} onUpdateTitle={(t, val) => updateTask(t.id, { title: val })} onUpdateDescription={(t, val) => updateTask(t.id, { description: val })} onEdit={setEditingTask} onDelete={deleteTask} onDragStart={onDragStart} />
                            ))}
                            {groupTasks.length === 0 && <div className="text-slate-600 text-xs italic p-4 text-center border border-dashed border-slate-800 rounded-lg">Nessun task in questa lista.</div>}
                        </div>
                    </SmoothCollapse>
                    </div>
                );
                })}
            </div>
            {!hasSections && (
                <div className="pt-8 border-t border-slate-800 flex justify-center mt-8">
                     <button onClick={addSection} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-primary/20 hover:text-primary rounded-lg text-sm text-slate-400 transition-colors border border-dashed border-slate-700">
                         <LayoutTemplate size={16} /> Attiva vista a Sezioni (Container)
                     </button>
                </div>
            )}
          </div>
        );
    } else {
        // --- SECTIONS VIEW ---
        
        // Multi-Select Filter Logic
        const sections = (activeProject.sections || []).filter(s => 
            selectedContainerIds.size === 0 || selectedContainerIds.has(s.id)
        );

        // Tasks without section or with invalid section id
        // Only show uncategorized if NO filter is selected, OR if we strictly want to filter by sections only, we might hide it.
        // Let's hide Uncategorized if specific sections are selected, unless we want to treat "Uncategorized" as a section.
        // For now: Show Uncategorized only if NO filter is active.
        const showUncategorized = selectedContainerIds.size === 0;
        const uncategorizedTasks = activeTasks.filter(t => !t.sectionId || !activeProject.sections?.find(s => s.id === t.sectionId));
        
        return (
            <div className="max-w-5xl mx-auto pb-20">
                <div className="space-y-6">
                    {/* 1. SECTIONS */}
                    {sections.map(section => {
                        const sectionTasks = activeTasks.filter(t => t.sectionId === section.id);
                        const isEditing = editingSectionId === section.id;
                        const isCollapsed = collapsedSections.has(section.id);

                        return (
                            <div 
                                key={section.id}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDropToSection(e, section.id)} 
                                className="rounded-xl min-h-[40px] border border-transparent hover:border-slate-800/50 transition-colors"
                            >
                                <div className="flex items-center justify-between border-b border-slate-700/50 pb-2 mb-3 select-none">
                                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleSection(section.id)}>
                                        <div className="p-1 rounded hover:bg-slate-800 text-slate-500">
                                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                        {isEditing ? (
                                            <form onClick={e => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); renameSection(section.id, newSectionName); }}>
                                                <input 
                                                    autoFocus
                                                    type="text" 
                                                    value={newSectionName}
                                                    onChange={(e) => setNewSectionName(e.target.value)}
                                                    onBlur={() => renameSection(section.id, newSectionName)}
                                                    className="bg-slate-800 text-white px-2 py-1 rounded text-sm font-bold outline-none border border-primary"
                                                />
                                            </form>
                                        ) : (
                                            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                                                <FolderPlus size={16} className="text-slate-500" />
                                                {section.name}
                                            </h3>
                                        )}
                                        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{sectionTasks.length}</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingSectionId(section.id); setNewSectionName(section.name); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><Pencil size={14}/></button>
                                        <button onClick={() => deleteSection(section.id)} className="p-1.5 hover:bg-red-900/30 hover:text-red-400 rounded text-slate-400"><Trash2 size={14}/></button>
                                    </div>
                                </div>

                                {/* SECTION CONTENT (Collapsible) */}
                                <SmoothCollapse isOpen={!isCollapsed}>
                                    <div className="space-y-4 pl-2">
                                        {[TaskStatus.TODO, TaskStatus.TEST, TaskStatus.DONE].map(status => {
                                            const tasksInStatus = sectionTasks.filter(t => t.status === status);
                                            if (tasksInStatus.length === 0) {
                                                if (sectionTasks.length === 0 && status === TaskStatus.TODO) {
                                                    return (
                                                         <div key={status} className="text-slate-700 text-xs italic p-4 text-center border border-dashed border-slate-800/50 rounded-lg">
                                                            Nessun task in questa sezione.
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }
                                            
                                            const isSubCollapsed = isSectionStatusCollapsed(section.id, status);
                                            const statusColor = {
                                                [TaskStatus.TODO]: 'border-slate-600 text-slate-400',
                                                [TaskStatus.TEST]: 'border-orange-600 text-orange-400',
                                                [TaskStatus.DONE]: 'border-green-600 text-green-400'
                                            }[status];

                                            return (
                                                <div 
                                                    key={status}
                                                    onDragOver={onDragOver}
                                                    onDrop={(e) => onDropToSectionAndStatus(e, section.id, status)}
                                                    className={`pl-3 border-l-2 ${statusColor.split(' ')[0]}`}
                                                >
                                                    <div 
                                                        className={`text-[10px] font-bold ${statusColor.split(' ')[1]} uppercase tracking-wider mb-2 flex items-center gap-1 cursor-pointer select-none`}
                                                        onClick={() => toggleSectionStatus(section.id, status)}
                                                    >
                                                        {isSubCollapsed ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}
                                                        {status} <span className="text-slate-600 ml-1">({tasksInStatus.length})</span>
                                                    </div>
                                                    
                                                    <SmoothCollapse isOpen={!isSubCollapsed}>
                                                        <div className="space-y-2">
                                                            {tasksInStatus.map(task => (
                                                                <TaskItem key={task.id} task={task} viewMode="LIST" isSelected={selectedTaskIds.has(task.id)} onToggleSelection={() => toggleTaskSelection(task.id)} onCycleStatus={cycleStatus} onCyclePriority={cyclePriority} onUpdateTitle={(t, val) => updateTask(t.id, { title: val })} onUpdateDescription={(t, val) => updateTask(t.id, { description: val })} onEdit={setEditingTask} onDelete={deleteTask} onDragStart={onDragStart} />
                                                            ))}
                                                        </div>
                                                    </SmoothCollapse>
                                                </div>
                                            );
                                        })}

                                        {/* Quick Add in Section */}
                                        <button 
                                            onClick={() => handleAddToSection(section.id)}
                                            className="w-full py-2 flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-primary hover:bg-slate-800/50 rounded-lg border border-dashed border-slate-800 hover:border-primary/30 transition-all group mt-2"
                                        >
                                            <Plus size={14} className="group-hover:scale-110 transition-transform" /> Aggiungi task a {section.name}
                                        </button>
                                    </div>
                                </SmoothCollapse>
                            </div>
                        );
                    })}

                    {/* 2. UNCATEGORIZED (Senza Sezione) */}
                    {showUncategorized && uncategorizedTasks.length > 0 && (
                    <div 
                        onDragOver={onDragOver}
                        onDrop={(e) => onDropToSection(e, undefined)} 
                        className="rounded-xl min-h-[50px] opacity-80 mt-8"
                    >
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-2 border-b border-slate-800 pb-2">
                            <LayoutTemplate size={16} /> Senza Sezione <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{uncategorizedTasks.length}</span>
                        </h3>
                        <div className="space-y-4">
                            {[TaskStatus.TODO, TaskStatus.TEST, TaskStatus.DONE].map(status => {
                                    const tasksInStatus = uncategorizedTasks.filter(t => t.status === status);
                                    if (tasksInStatus.length === 0) return null;
                                    return (
                                        <div key={status} onDragOver={onDragOver} onDrop={(e) => onDropToSectionAndStatus(e, null, status)} className="space-y-2">
                                            {tasksInStatus.map(task => (
                                            <TaskItem key={task.id} task={task} viewMode="LIST" isSelected={selectedTaskIds.has(task.id)} onToggleSelection={() => toggleTaskSelection(task.id)} onCycleStatus={cycleStatus} onCyclePriority={cyclePriority} onUpdateTitle={(t, val) => updateTask(t.id, { title: val })} onUpdateDescription={(t, val) => updateTask(t.id, { description: val })} onEdit={setEditingTask} onDelete={deleteTask} onDragStart={onDragStart} />
                                            ))}
                                        </div>
                                    )
                            })}
                        </div>
                    </div>
                    )}

                    <div className="pt-8 border-t border-slate-800 flex justify-center">
                        <button onClick={addSection} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20">
                            <FolderPlus size={18} /> Aggiungi Nuova Sezione
                        </button>
                    </div>
                </div>
            </div>
        );
    }
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
                draggable
                onDragStart={(e) => onProjectDragStart(e, p.id)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={(e) => handleProjectDrop(e, p.id)}
                onClick={() => { setActiveProjectId(p.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${activeProjectId === p.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'}`}
              >
                <span className="truncate flex-1 select-none">{p.name}</span>
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
            
            {/* Project Switcher */}
            {!isSidebarOpen && projects.length > 0 ? (
                <div className="relative z-50">
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
            <>
               {/* Container Filters - MULTI SELECT DROPDOWN */}
               {viewMode === 'LIST' && hasSections && (
                 <div className="hidden md:flex items-center gap-2 relative">
                    <button 
                        onClick={() => setIsContainerFilterOpen(!isContainerFilterOpen)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${selectedContainerIds.size > 0 ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-slate-900/50 border-slate-800/50 text-slate-400 hover:text-slate-200'}`}
                    >
                        <Filter size={14} />
                        {selectedContainerIds.size > 0 ? `${selectedContainerIds.size} Filtri` : 'Tutti i container'}
                        <ChevronDown size={12} />
                    </button>
                    
                    {/* Filter Dropdown */}
                    {isContainerFilterOpen && (
                        <>
                         <div className="fixed inset-0 z-20" onClick={() => setIsContainerFilterOpen(false)}></div>
                         <div className="absolute top-full left-0 mt-2 w-64 bg-surface border border-slate-700/50 rounded-xl shadow-2xl p-2 z-30 flex flex-col gap-2 animate-in fade-in zoom-in-95 origin-top-left">
                             <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                                <input 
                                    autoFocus
                                    type="text"
                                    value={containerDropdownSearch}
                                    onChange={(e) => setContainerDropdownSearch(e.target.value)}
                                    placeholder="Cerca container..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                                />
                             </div>
                             <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                {(activeProject.sections || []).filter(s => s.name.toLowerCase().includes(containerDropdownSearch.toLowerCase())).map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => toggleContainerSelection(s.id)}
                                        className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-2 group/item"
                                    >
                                        <div className={`transition-colors ${selectedContainerIds.has(s.id) ? 'text-primary' : 'text-slate-600 group-hover/item:text-slate-400'}`}>
                                            {selectedContainerIds.has(s.id) ? <CheckSquare size={14}/> : <Square size={14}/>}
                                        </div>
                                        <span className="truncate flex-1">{s.name}</span>
                                    </button>
                                ))}
                             </div>
                             {selectedContainerIds.size > 0 && (
                                 <button onClick={() => setSelectedContainerIds(new Set())} className="text-xs text-center py-1 text-slate-500 hover:text-white border-t border-slate-700 pt-2">
                                     Deseleziona tutto
                                 </button>
                             )}
                         </div>
                        </>
                    )}
                 </div>
               )}

              <div className="relative w-64 hidden xl:block shrink-0 mx-2">
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
                            <span className="text-[10px] font-bold">Alt</span> K
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
            </>
          )}

          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 shrink-0 ml-2">
            {/* View Mode Toggles */}
            {viewMode === 'LIST' && hasSections && (
                <div className="flex bg-slate-800 rounded mr-2 p-0.5">
                    <button 
                       onClick={() => setGroupByContainer(true)}
                       className={`p-1 rounded text-[10px] font-bold transition-all ${groupByContainer ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'}`}
                       title="Raggruppa per Container"
                    >
                       <Layers size={14}/>
                    </button>
                    <button 
                       onClick={() => setGroupByContainer(false)}
                       className={`p-1 rounded text-[10px] font-bold transition-all ${!groupByContainer ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'}`}
                       title="Raggruppa per Stato"
                    >
                       <ListTodo size={14}/>
                    </button>
                </div>
            )}
            
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

        {/* Content View */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 custom-scrollbar pb-24">
           {/* Improved Input Area (Now Inside Scrollable & COMPACT) */}
           {activeProject && (
             <div className="max-w-5xl mx-auto relative bg-surface border border-slate-700 rounded-xl shadow-lg p-2 mb-6">
               <form onSubmit={handleQuickAdd} className="flex flex-col gap-2">
                 
                 {/* Main Row: Input + Actions */}
                 <div className="flex items-center gap-2">
                     <div className="flex-1 flex items-center bg-slate-900/50 border border-transparent focus-within:border-primary/50 rounded-lg px-3 transition-all relative">
                         {targetSectionId && (
                             <span className="flex items-center gap-1 bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 shrink-0 select-none">
                                 In: {activeProject.sections?.find(s => s.id === targetSectionId)?.name || '...'}
                                 <button type="button" onClick={() => setTargetSectionId(null)} className="hover:text-white"><X size={10}/></button>
                             </span>
                         )}
                         <input
                           ref={newTaskInputRef}
                           type="text"
                           value={newTaskTitle}
                           onChange={(e) => setNewTaskTitle(e.target.value)}
                           onKeyDown={(e) => {
                               if (e.key === 'Enter') {
                                   handleQuickAdd(e);
                               }
                           }}
                           placeholder="Nuovo Task..."
                           className="flex-1 bg-transparent border-none py-2 text-slate-100 placeholder-slate-400 focus:outline-none text-sm font-medium h-9"
                         />
                     </div>

                     {/* Action Buttons */}
                     <div className="flex items-center gap-1">
                         <button 
                             type="button"
                             onClick={() => setShowTaskDescInput(!showTaskDescInput)}
                             className={`p-2 rounded-lg transition-colors flex items-center justify-center ${showTaskDescInput ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                             title="Aggiungi Note"
                         >
                             <FileText size={16} />
                         </button>
                         
                         {(newTaskTitle || newTaskDesc) && (
                             <button 
                                 type="button"
                                 onClick={handleClearInput}
                                 className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                 title="Svuota tutto"
                             >
                                 <Eraser size={16} />
                             </button>
                         )}

                         <button 
                             type="button"
                             onClick={() => setAiModalOpen(true)}
                             className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                             title="Genera con AI"
                         >
                             <Sparkles size={16} />
                         </button>
                         
                         <button 
                             type="submit" 
                             disabled={!newTaskTitle.trim()}
                             className="bg-primary hover:bg-blue-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center"
                         >
                             <Plus size={20} />
                         </button>
                     </div>
                 </div>

                 {/* Collapsible Description Input */}
                 {showTaskDescInput && (
                     <div className="animate-in slide-in-from-top-2">
                        <textarea
                             id="newTaskDesc"
                             value={newTaskDesc}
                             onChange={(e) => setNewTaskDesc(e.target.value)}
                             onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAdd(e); }
                             }}
                             placeholder="Note aggiuntive..."
                             rows={2}
                             className="w-full bg-slate-900/30 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
                         />
                     </div>
                 )}
               </form>
             </div>
           )}

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
                  {/* WRAPPER con padding-bottom per fare da ponte tra bottone e menu */}
                  <div className="absolute bottom-full left-0 pb-2 w-32 hidden group-hover:block animate-in fade-in zoom-in-95 z-50">
                      <div className="bg-surface border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                        <button onClick={() => handleBulkStatusChange(TaskStatus.TODO)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-300 flex items-center gap-2"><Circle size={10}/> Da Fare</button>
                        <button onClick={() => handleBulkStatusChange(TaskStatus.TEST)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-orange-400 flex items-center gap-2"><Clock size={10}/> Test</button>
                        <button onClick={() => handleBulkStatusChange(TaskStatus.DONE)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-green-400 flex items-center gap-2"><CheckCircle2 size={10}/> Fatto</button>
                      </div>
                  </div>
              </div>

              <div className="h-6 w-px bg-slate-700/50"></div>

              <button 
                  type="button"
                  // Stop propagation to prevent drag events or losing focus
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

        {isSectionModalOpen && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-surface border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95">
                    <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <FolderPlus size={18} className="text-primary" />
                            Nuova Sezione
                        </h3>
                        <button onClick={() => setIsSectionModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                    <form onSubmit={handleCreateSection} className="p-4 flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome Sezione</label>
                            <input 
                                autoFocus
                                type="text" 
                                value={sectionModalName}
                                onChange={(e) => setSectionModalName(e.target.value)}
                                placeholder="Es. Backlog, Sprint 1, Marketing..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button 
                                type="button" 
                                onClick={() => setIsSectionModalOpen(false)} 
                                className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                Annulla
                            </button>
                            <button 
                                type="submit" 
                                disabled={!sectionModalName.trim()}
                                className="px-4 py-2 bg-primary hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Plus size={14} /> Crea Sezione
                            </button>
                        </div>
                    </form>
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