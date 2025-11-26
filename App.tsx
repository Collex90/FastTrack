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
  Sun,
  Moon
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
  writeBatch
} from 'firebase/firestore';

// --- Helpers ---

const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// --- Components ---

const PriorityBadge = ({ priority, onClick }: { priority: TaskPriority; onClick?: () => void }) => {
  const styles = {
    [TaskPriority.LOW]: 'text-textMuted hover:bg-surface-hover',
    [TaskPriority.MEDIUM]: 'text-warning hover:bg-warning/10',
    [TaskPriority.HIGH]: 'text-red-500 hover:bg-red-500/10',
  };

  const icons = {
    [TaskPriority.LOW]: <Flag size={14} />,
    [TaskPriority.MEDIUM]: <AlertCircle size={14} />,
    [TaskPriority.HIGH]: <ArrowUpCircle size={14} />,
  };

  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all ${styles[priority]}`}
      title={`Priorità: ${priority}`}
    >
      {icons[priority]}
      <span className="hidden sm:inline">{priority}</span>
    </button>
  );
};

const StatusBadge = ({ status, onClick }: { status: TaskStatus; onClick?: () => void }) => {
  const styles = {
    [TaskStatus.TODO]: 'bg-surface-hover text-textMuted border-border hover:bg-border',
    [TaskStatus.TEST]: 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20',
    [TaskStatus.DONE]: 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20',
  };

  const icons = {
    [TaskStatus.TODO]: <Circle size={14} className="mr-1.5" />,
    [TaskStatus.TEST]: <Clock size={14} className="mr-1.5" />,
    [TaskStatus.DONE]: <CheckCircle2 size={14} className="mr-1.5" />,
  };

  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      className={`flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]} transition-all`}
    >
      {icons[status]}
      {status}
    </button>
  );
};

// Component for Inline Editable Text
const InlineEditableText = ({ 
  text, 
  isDone = false, 
  onSave,
  className = "",
  placeholder = ""
}: { 
  text: string; 
  isDone?: boolean; 
  onSave: (newText: string) => void;
  className?: string;
  placeholder?: string;
}) => {
  const [value, setValue] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      // HACK: CRITICAL FIX FOR DRAG & DROP
      // 1. draggable=true on input allows us to intercept the drag start
      // 2. onDragStart prevents default, stopping the parent card from being dragged
      draggable={true}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      // 3. onPointerDown stops the drag initiation logic of browsers before it even starts
      onPointerDown={(e) => e.stopPropagation()}
      className={`w-full bg-transparent border border-transparent rounded px-1 -ml-1 resize-none overflow-hidden focus:bg-surface focus:border-border focus:outline-none focus:ring-1 focus:ring-primary transition-all whitespace-pre-wrap break-words cursor-text pointer-events-auto ${isDone ? 'text-textMuted line-through' : 'text-textMain'} ${className}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      rows={1}
      placeholder={placeholder}
    />
  );
};

const CollapsibleDescription = ({ text, onUpdate }: { text: string, onUpdate: (val: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    if (!text) return null;

    return (
        <div className="mt-2 w-full" onPointerDown={(e) => e.stopPropagation()}>
            {!isOpen ? (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-textMuted hover:text-primary transition-colors select-none"
                >
                    <ChevronDown size={12} />
                    Mostra note ({text.split('\n')[0].substring(0, 30)}...)
                </button>
            ) : (
                <div 
                    className="bg-surface rounded p-2 border border-border w-full animate-in fade-in zoom-in-95 duration-200 cursor-auto shadow-sm"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-1 text-[11px] text-primary hover:text-blue-400 font-medium mb-1 select-none"
                    >
                        <ChevronUp size={12} /> Nascondi note
                    </button>
                    <InlineEditableText 
                        text={text} 
                        onSave={onUpdate}
                        className="text-xs text-textMuted min-h-[60px]"
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
      // Safety check: if we are interacting with input/button, stop drag
      if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(target.tagName)) {
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
      className={`group relative bg-surface rounded-xl border transition-all shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing ${viewMode === 'LIST' ? 'flex flex-col md:flex-row md:items-start p-3 mb-2' : 'p-2.5 mb-2 flex flex-col'} ${isSelected ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-primary/40'}`}
    >
      <div className="absolute left-1 top-1/2 -translate-y-1/2 text-textMuted opacity-0 group-hover:opacity-100 transition-opacity hidden md:block pointer-events-none">
          <GripVertical size={14} />
      </div>

      <div className={`flex items-start flex-1 min-w-0 ${viewMode === 'LIST' ? 'md:ml-3 md:mr-4' : 'mb-1.5'}`}>
         {/* Checkbox Selection */}
         <div 
            onClick={(e) => { e.stopPropagation(); onToggleSelection(); }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className={`mr-2 mt-1 cursor-pointer transition-colors ${isSelected ? 'text-primary' : 'text-textMuted hover:text-textMain'}`}
         >
             {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
         </div>

         <div className="flex-1 min-w-0">
            <InlineEditableText 
            text={task.title} 
            isDone={task.status === TaskStatus.DONE} 
            onSave={(val) => onUpdateTitle(task, val)} 
            className="text-sm font-medium"
            />
            {viewMode === 'LIST' && task.description && (
            <CollapsibleDescription 
                text={task.description} 
                onUpdate={(val) => onUpdateDescription(task, val)}
            />
            )}
            {viewMode === 'KANBAN' && task.description && (
            <div className="mt-1.5 text-xs text-textMuted line-clamp-3 whitespace-pre-wrap leading-tight">{task.description}</div>
            )}
         </div>
      </div>

      <div className={`flex items-center justify-between ${viewMode === 'LIST' ? 'gap-3 mt-2 md:mt-0 md:self-start' : 'w-full pt-1.5 border-t border-border'}`}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <StatusBadge status={task.status} onClick={() => onCycleStatus(task)} />
          <PriorityBadge priority={task.priority} onClick={() => onCyclePriority(task)} />
        </div>
        
        <div className={`flex items-center gap-1 transition-opacity`}>
          <button 
              onClick={handleCopy}
              className="p-1.5 text-textMuted hover:text-green-500 hover:bg-surface-hover rounded transition-colors"
              title="Copia Titolo e Note (Inline)"
          >
              {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          <button 
              onClick={() => onEdit(task)}
              className="p-1.5 text-textMuted hover:text-primary hover:bg-surface-hover rounded transition-colors"
              title="Modifica dettaglio"
          >
              <Pencil size={14} />
          </button>
          <button 
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} 
              className="p-1.5 text-textMuted hover:text-red-400 hover:bg-surface-hover rounded transition-colors"
              title="Elimina"
          >
              <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Config Modal ---

const FirebaseConfigModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (cfg: any) => void }) => {
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
                <button onClick={onClose} className="absolute top-4 right-4 text-textMuted hover:text-textMain"><X size={20}/></button>
                
                <div className="flex items-center gap-3 mb-6 shrink-0">
                    <div className="w-10 h-10 bg-orange-500/20 text-orange-500 rounded-lg flex items-center justify-center">
                        <Database size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-textMain">Configurazione Firebase</h1>
                        <p className="text-sm text-textMuted">Connetti il tuo database Cloud</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div className="mb-6 bg-background p-4 rounded-xl border border-border">
                        <label className="text-xs font-bold text-textMuted uppercase tracking-wider mb-2 flex items-center gap-2">
                            <ClipboardPaste size={14} />
                            Incolla Configurazione Rapida
                        </label>
                        <textarea
                            value={pasteInput}
                            onChange={(e) => setPasteInput(e.target.value)}
                            placeholder={`const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  ...\n};`}
                            className="w-full bg-surface border border-border rounded-lg p-3 text-xs font-mono text-textMain focus:border-primary focus:outline-none h-24 resize-none mb-2"
                        />
                        <button
                            onClick={handlePasteParse}
                            disabled={!pasteInput.trim()}
                            className="w-full py-1.5 bg-surface hover:bg-surface-hover text-textMuted text-xs font-medium rounded border border-border transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <ArrowDown size={12} />
                            Analizza ed Estrai Dati
                        </button>
                        {parseSuccess && (
                            <div className="mt-2 text-xs text-green-500 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Campi compilati con successo!
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {Object.keys(config).map((key) => (
                            <div key={key}>
                                <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1 block">{key}</label>
                                <input 
                                    type="text"
                                    name={key}
                                    value={(config as any)[key]}
                                    onChange={handleChange}
                                    placeholder={`...`}
                                    className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:border-primary focus:outline-none"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-6 flex gap-3 shrink-0 pt-4 border-t border-border">
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

// --- Login Screen ---

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
    
    if (!isFirebaseConfigured) {
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
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-8 relative z-10 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-purple-600 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center mb-4">
            <LayoutList className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-textMain mb-1">FastTrack</h1>
          <p className="text-textMuted text-sm text-center">
            {isFirebaseConfigured 
                ? (isRegister ? 'Crea un account Cloud' : 'Accedi al tuo account Cloud')
                : 'Modalità Locale: Accedi con qualsiasi credenziale'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-textMuted ml-1">USERNAME / EMAIL</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={18} />
              <input 
                type={isFirebaseConfigured ? "email" : "text"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isFirebaseConfigured ? "nome@esempio.com" : "Inserisci un nome a caso..."}
                className="w-full bg-background border border-border rounded-lg py-2.5 pl-10 pr-4 text-textMain placeholder-textMuted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-textMuted ml-1">PASSWORD</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-background border border-border rounded-lg py-2.5 pl-10 pr-4 text-textMain placeholder-textMuted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          {!isFirebaseConfigured && (
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs p-3 rounded-lg flex items-start gap-2">
                  <WifiOff size={14} className="shrink-0 mt-0.5" />
                  <span>
                      Firebase non è configurato. L'accesso avverrà in <strong>Modalità Locale</strong>.
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
            className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
                className="text-sm text-textMuted hover:text-textMain transition-colors"
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
  const [mockUser, setMockUser] = useState<User | null>(null);
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const user = isFirebaseConfigured ? fbUser : mockUser;

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  
  const [collapsedGroups, setCollapsedGroups] = useState<Record<TaskStatus, boolean>>({
      [TaskStatus.TODO]: false,
      [TaskStatus.TEST]: false,
      [TaskStatus.DONE]: true
  });
  
  const [dbError, setDbError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newProjectInput, setNewProjectInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
      return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const projectSelectorRef = useRef<HTMLDivElement>(null);
  
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Theme Effect ---
  useEffect(() => {
      if (theme === 'light') {
          document.documentElement.classList.add('light');
      } else {
          document.documentElement.classList.remove('light');
      }
      localStorage.setItem('theme', theme);
  }, [theme]);

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

  // --- Click Outside Project Selector ---
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (projectSelectorRef.current && !projectSelectorRef.current.contains(event.target as Node)) {
              setProjectSelectorOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  useEffect(() => {
    setSelectedTaskIds(new Set());
    setSearchQuery('');
    setProjectSelectorOpen(false);
  }, [activeProjectId, viewMode]);

  useEffect(() => {
    if (!user) { setProjects([]); return; }
    if (isFirebaseConfigured && db) {
        setDbError(null);
        const q = query(collection(db, "projects"), where("userId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)).sort((a, b) => a.createdAt - b.createdAt);
            setProjects(projData);
            if (projData.length > 0 && !activeProjectId) setActiveProjectId(projData[0].id);
        }, (error) => {
            if (error.code === 'permission-denied') setDbError("Permesso negato. Controlla le regole di sicurezza.");
        });
        return () => unsubscribe();
    } else {
        const saved = localStorage.getItem(`ft_projects_local`);
        if (saved) {
            const parsed = JSON.parse(saved) as Project[];
            if (Array.isArray(parsed)) {
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
        }, (error) => {
             if (error.code === 'permission-denied') setDbError((prev) => prev || "Permesso negato.");
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

  const handleMockLogin = () => {
      const fakeUser: any = { uid: 'local-user', email: 'local@demo.com', displayName: 'Utente Locale' };
      setMockUser(fakeUser);
  };

  const handleLogout = () => {
    if(isFirebaseConfigured && auth) signOut(auth);
    else setMockUser(null);
  };

  const addProject = async () => {
    if (!newProjectInput.trim() || !user) return;
    const newProjData = { userId: user.uid, name: newProjectInput.trim(), createdAt: Date.now() };

    if (isFirebaseConfigured && db) {
        try { await addDoc(collection(db, "projects"), newProjData); } catch (e) { console.error(e); }
    } else {
        const newProj: Project = { id: generateId(), ...newProjData };
        saveLocalProjects([...projects, newProj]);
        setActiveProjectId(newProj.id);
    }
    setNewProjectInput('');
  };

  const renameProject = async (newName: string) => {
    if (!activeProjectId || !newName.trim()) return;
    if (isFirebaseConfigured && db) {
        try { await updateDoc(doc(db, "projects", activeProjectId), { name: newName.trim() }); } catch (e) { console.error(e); }
    } else {
        const updated = projects.map(p => p.id === activeProjectId ? { ...p, name: newName.trim() } : p);
        saveLocalProjects(updated);
    }
    setEditingProjectName(null);
  };

  const deleteProject = async (projId: string, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
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
        const updatedTasks = tasks.filter(t => t.projectId !== projId);
        saveLocalTasks(updatedTasks);
    }
  };

  const addTask = async (title: string, desc: string) => {
    if (!activeProjectId || !title.trim() || !user) return;
    const newTaskData = {
        userId: user.uid, projectId: activeProjectId, title: title.trim(), description: desc.trim(),
        status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, createdAt: Date.now()
    };
    if (isFirebaseConfigured && db) {
        try { await addDoc(collection(db, "tasks"), newTaskData); } catch(e) { console.error(e); }
    } else {
        const newTask: Task = { id: generateId(), ...newTaskData };
        saveLocalTasks([...tasks, newTask]);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (isFirebaseConfigured && db) {
        try { await updateDoc(doc(db, "tasks", taskId), updates); } catch(e) { console.error(e); }
    } else {
        const updated = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
        saveLocalTasks(updated);
    }
  };

  const deleteTask = async (taskId: string) => {
     await updateTask(taskId, { deletedAt: Date.now() });
  };

  const toggleTaskSelection = (taskId: string) => {
      const newSet = new Set(selectedTaskIds);
      if (newSet.has(taskId)) newSet.delete(taskId); else newSet.add(taskId);
      setSelectedTaskIds(newSet);
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

  const handleBulkDelete = () => {
      const count = selectedTaskIds.size;
      if (count === 0) return;
      
      // Use setTimeout to allow the UI to register the click and clear any drag states
      // before blocking with window.confirm
      setTimeout(async () => {
          if (!window.confirm(`Eliminare ${count} task?`)) return;
          
          const ids = Array.from(selectedTaskIds);
          
          if (isFirebaseConfigured && db) {
              try {
                const batch = writeBatch(db);
                ids.forEach(id => {
                    const ref = doc(db!, "tasks", id);
                    batch.update(ref, { deletedAt: Date.now() });
                });
                await batch.commit();
              } catch(e) { console.error(e); alert("Errore durante l'eliminazione."); }
          } else {
              // Ensure we create a new array reference for Local State
              const updated = tasks.map(t => selectedTaskIds.has(t.id) ? { ...t, deletedAt: Date.now() } : t);
              saveLocalTasks(updated);
          }
          setSelectedTaskIds(new Set());
      }, 50);
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

  const generateAiTasks = async () => {
    if (!activeProjectId || !aiPrompt.trim() || !user) return;
    setIsAiLoading(true);
    try {
      const generated = await generateTasksFromInput(String(aiPrompt), String(activeProjectId));
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
    } catch (error: any) { alert("Errore AI."); } finally { setIsAiLoading(false); }
  };

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
            return (t.title.toLowerCase().includes(query) || (t.description && t.description.toLowerCase().includes(query)));
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
      [TaskStatus.TODO]: TaskStatus.TEST, [TaskStatus.TEST]: TaskStatus.DONE, [TaskStatus.DONE]: TaskStatus.TODO
    };
    updateTask(task.id, { status: map[task.status] });
  };

  const cyclePriority = (task: Task) => {
    const map: Record<TaskPriority, TaskPriority> = {
      [TaskPriority.LOW]: TaskPriority.MEDIUM, [TaskPriority.MEDIUM]: TaskPriority.HIGH, [TaskPriority.HIGH]: TaskPriority.LOW
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

  if (authLoading) return <div className="flex items-center justify-center min-h-screen bg-background text-primary"><Loader2 className="animate-spin" size={48} /></div>;
  if (!user) return <LoginScreen onMockLogin={handleMockLogin} />;

  const renderKanbanColumn = (status: TaskStatus, title: string, colorClass: string, borderColorClass: string) => {
    const colTasks = activeTasks.filter(t => t.status === status);
    return (
      <div 
        className="flex-1 min-w-[300px] flex flex-col h-full bg-surface-hover/30 rounded-xl border border-border transition-colors"
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, status)}
      >
        <div className={`p-4 border-b border-border flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-sm rounded-t-xl z-10`}>
          <div className="flex items-center gap-2">
            <h3 className={`font-bold ${colorClass} text-sm uppercase tracking-wide`}>{title}</h3>
          </div>
          <span className="text-xs font-mono text-textMuted bg-surface px-2 py-0.5 rounded-md">{colTasks.length}</span>
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
          {colTasks.length === 0 && <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-textMuted text-xs pointer-events-none">Trascina qui i task</div>}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const groups = [
        { status: TaskStatus.TODO, label: 'DA FARE', color: 'text-textMain', border: 'border-textMuted' },
        { status: TaskStatus.TEST, label: 'DA TESTARE', color: 'text-orange-500', border: 'border-orange-600' },
        { status: TaskStatus.DONE, label: 'COMPLETATO', color: 'text-green-500', border: 'border-green-600' }
    ];

    return (
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        {groups.map(group => {
          const groupTasks = activeTasks.filter(t => t.status === group.status);
          const isCollapsed = collapsedGroups[group.status];
          return (
            <div key={group.status} onDragOver={onDragOver} onDrop={(e) => onDrop(e, group.status)} className="rounded-xl min-h-[50px]">
              <h3 
                onClick={() => setCollapsedGroups(prev => ({...prev, [group.status]: !prev[group.status]}))}
                className={`text-sm font-bold ${group.color} uppercase tracking-wider mb-3 px-1 flex items-center gap-2 border-b ${group.border} pb-2 cursor-pointer hover:bg-surface-hover rounded-t transition-colors select-none`}
              >
                 {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                 {group.label} <span className="bg-surface text-textMuted px-2 py-0.5 rounded-full text-[10px]">{groupTasks.length}</span>
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
                    {groupTasks.length === 0 && <div className="text-textMuted text-xs italic p-4 text-center border border-dashed border-border rounded-lg">Nessun task in questa lista.</div>}
                  </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-textMain font-sans selection:bg-primary/30 transition-colors duration-300">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-surface border-r border-border transition-all duration-300 flex flex-col overflow-hidden whitespace-nowrap z-20 absolute md:relative h-full shadow-xl`}>
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface shrink-0">
           <div className="font-bold text-lg tracking-tight text-textMain flex items-center gap-2">
             <div className="w-6 h-6 bg-gradient-to-br from-primary to-purple-600 rounded-md"></div>
             FastTrack
           </div>
           <button onClick={() => setIsSidebarOpen(false)} className="text-textMuted hover:text-textMain transition-colors">
              <PanelLeftClose size={20}/>
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-xs font-semibold text-textMuted mb-2 px-2 flex justify-between items-center">
            <span>PROGETTI</span>
            {projects.length === 0 && <span className="text-[10px] text-blue-400">Crea il primo!</span>}
          </div>
          <div className="space-y-1">
            {projects.map(p => (
              <div 
                key={p.id}
                onClick={() => { setActiveProjectId(p.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${activeProjectId === p.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-textMuted hover:bg-surface-hover hover:text-textMain border border-transparent'}`}
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

        <div className="p-3 border-t border-border bg-surface-hover/20 shrink-0 space-y-3">
           <form onSubmit={(e) => { e.preventDefault(); addProject(); }} className="flex gap-2">
             <input 
               type="text" 
               placeholder="Nuovo Progetto..." 
               value={newProjectInput}
               onChange={(e) => setNewProjectInput(e.target.value)}
               className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs text-textMain placeholder-textMuted focus:outline-none focus:border-primary"
             />
             <button type="submit" disabled={!newProjectInput.trim()} className="bg-surface-hover hover:bg-primary hover:text-white text-textMain p-1.5 rounded-md transition-colors disabled:opacity-50">
               <Plus size={16} />
             </button>
           </form>
           
           <div className="flex items-center justify-between pt-2 border-t border-border">
             <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-surface-hover flex items-center justify-center text-[10px] font-bold text-textMain border border-border">
                  {user.email ? user.email[0].toUpperCase() : <UserIcon size={12} />}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-xs text-textMuted truncate max-w-[100px]" title={user.email || ''}>{user.email}</span>
                    {!isFirebaseConfigured && <span className="text-[9px] text-orange-500 font-bold uppercase">Locale</span>}
                </div>
             </div>
             <div className="flex items-center">
                 <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="text-textMuted hover:text-textMain p-1.5 rounded hover:bg-surface-hover transition-colors" 
                    title={theme === 'dark' ? "Passa a Tema Chiaro" : "Passa a Tema Scuro"}
                 >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                 </button>
                 <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-textMuted hover:text-textMain p-1.5 rounded hover:bg-surface-hover transition-colors" 
                    title="Impostazioni"
                 >
                    <SettingsIcon size={14} />
                 </button>
                 <button 
                    onClick={handleLogout} 
                    className="text-textMuted hover:text-textMain p-1.5 rounded hover:bg-surface-hover transition-colors" 
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
        
        {dbError && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-3 text-red-500 text-xs font-medium animate-in slide-in-from-top-2">
            <ShieldAlert size={16} className="shrink-0" />
            <div className="flex-1">{dbError}</div>
          </div>
        )}

        {/* Header - Z-30 to stay above Input Area */}
        <header className="h-16 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur-md sticky top-0 z-30 shrink-0 gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-textMuted hover:bg-surface-hover rounded-lg transition-colors">
                <Menu size={20} />
              </button>
            )}
            
            {/* Project Switcher logic when sidebar is closed */}
            {!isSidebarOpen && projects.length > 0 ? (
                <div className="relative" ref={projectSelectorRef}>
                    <button 
                        onClick={() => setProjectSelectorOpen(!projectSelectorOpen)}
                        className="flex items-center gap-2 hover:bg-surface-hover p-2 rounded-lg transition-colors group"
                    >
                        <div className="w-6 h-6 bg-gradient-to-br from-primary to-purple-600 rounded-md shrink-0"></div>
                        <h1 className="text-xl font-bold text-textMain truncate max-w-[200px]">
                            {activeProject?.name || "Seleziona"}
                        </h1>
                        <ChevronDown size={16} className="text-textMuted group-hover:text-textMain" />
                    </button>
                    
                    {projectSelectorOpen && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-surface border border-border rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95">
                            <div className="text-[10px] font-bold text-textMuted px-3 py-2 uppercase tracking-wider">I tuoi progetti</div>
                            {projects.map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => { setActiveProjectId(p.id); setProjectSelectorOpen(false); }}
                                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-surface-hover flex items-center justify-between ${activeProjectId === p.id ? 'text-primary font-medium bg-primary/5' : 'text-textMain'}`}
                                >
                                    <span className="truncate">{p.name}</span>
                                    {activeProjectId === p.id && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                activeProject && editingProjectName !== null ? (
                   <form className="flex-1 max-w-md" onSubmit={(e) => { e.preventDefault(); renameProject(editingProjectName); }}>
                     <input 
                       autoFocus type="text" value={editingProjectName} onChange={(e) => setEditingProjectName(e.target.value)}
                       onBlur={() => renameProject(editingProjectName)}
                       className="bg-surface-hover border border-primary rounded px-2 py-1 text-textMain font-bold text-lg w-full outline-none"
                     />
                   </form>
                ) : (
                  <div className="group flex items-center gap-3 overflow-hidden min-w-0">
                    <h1 className="text-xl font-bold text-textMain truncate">
                      {activeProject?.name || (projects.length > 0 ? "Seleziona un progetto" : "Crea un progetto")}
                    </h1>
                    {activeProject && (
                      <button onClick={() => setEditingProjectName(activeProject.name)} className="opacity-0 group-hover:opacity-100 p-1 text-textMuted hover:text-primary transition-all shrink-0">
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                )
            )}
          </div>

          {activeProject && (
              <div className="relative flex-1 max-w-xs hidden sm:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={16} />
                  <input 
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca task..."
                    className="w-full bg-surface border border-border rounded-lg pl-9 pr-12 py-1.5 text-sm text-textMain focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-textMuted"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                     {!searchQuery ? (
                         <span className="text-[10px] text-textMuted border border-border rounded px-1.5 py-0.5 font-mono flex items-center gap-0.5"><Command size={8} /> K</span>
                     ) : (
                        <button onClick={() => setSearchQuery('')} className="text-textMuted hover:text-textMain pointer-events-auto"><X size={14} /></button>
                     )}
                  </div>
              </div>
          )}

          <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-border shrink-0 ml-2">
            <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-surface-hover text-textMain shadow-sm' : 'text-textMuted hover:text-textMain'}`} title="Vista Lista"><LayoutList size={18} /></button>
            <button onClick={() => setViewMode('KANBAN')} className={`p-1.5 rounded-md transition-all ${viewMode === 'KANBAN' ? 'bg-surface-hover text-textMain shadow-sm' : 'text-textMuted hover:text-textMain'}`} title="Vista Kanban"><KanbanIcon size={18} /></button>
          </div>
        </header>

        {activeProject && (
             <div className="sm:hidden px-4 pt-4 pb-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={16} />
                    <input 
                        type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cerca task..."
                        className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-textMain focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    />
                </div>
             </div>
        )}

        {/* Improved Input Area */}
        {activeProject && (
          <div className="p-4 md:p-6 pb-2 shrink-0 z-20">
            <div className="max-w-5xl mx-auto relative bg-surface border border-border rounded-xl shadow-lg p-3">
              <form onSubmit={handleQuickAdd} className="flex flex-col gap-2">
                <textarea
                  ref={titleTextareaRef}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('newTaskDesc')?.focus(); }}}
                  placeholder="Titolo Task..."
                  rows={1}
                  className="w-full bg-surface-hover/30 border-b border-transparent focus:border-primary/50 rounded-t px-3 py-2 text-textMain placeholder-textMuted focus:outline-none transition-all resize-none font-medium"
                />
                
                <div className="flex gap-2">
                    <textarea
                        id="newTaskDesc"
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAdd(e); }}}
                        placeholder="Note..."
                        rows={1}
                        className="flex-1 bg-surface-hover/30 border border-border rounded-lg px-3 py-2 text-sm text-textMain placeholder-textMuted focus:outline-none focus:border-border resize-none min-h-[38px]"
                    />
                    
                    <button type="button" onClick={() => setAiModalOpen(true)} className="px-3 py-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium border border-border hover:border-purple-500/30" title="AI"><Sparkles size={16} /></button>
                    <button type="submit" disabled={!newTaskTitle.trim()} className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shadow-md flex items-center justify-center"><Plus size={20} /></button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 custom-scrollbar pb-24">
           {viewMode === 'LIST' ? renderListView() : (
             <div className="h-full flex gap-4 overflow-x-auto pb-4 snap-x">
               {renderKanbanColumn(TaskStatus.TODO, 'Da Fare', 'text-textMain', 'border-border')}
               {renderKanbanColumn(TaskStatus.TEST, 'Da Testare', 'text-orange-500', 'border-orange-600')}
               {renderKanbanColumn(TaskStatus.DONE, 'Completati', 'text-green-500', 'border-green-600')}
             </div>
           )}
        </div>
        
        {/* Bulk Action Bar */}
        {selectedTaskIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface/90 backdrop-blur-md border border-border rounded-2xl shadow-2xl p-2 px-4 flex items-center gap-3 animate-in slide-in-from-bottom-6 z-40 max-w-[90vw] no-drag">
              <div className="flex items-center gap-2 border-r border-border pr-3 mr-1">
                  <div className="bg-primary text-white text-xs font-bold rounded-md w-6 h-6 flex items-center justify-center">{selectedTaskIds.size}</div>
                  <span className="text-xs font-medium text-textMuted hidden sm:inline">Selezionati</span>
              </div>

              <button onClick={handleBulkCopy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-textMain hover:bg-surface-hover rounded-lg transition-colors">
                  <Copy size={14} /> <span className="hidden sm:inline">Copia</span>
              </button>

              <div className="h-6 w-px bg-border"></div>

              <div className="relative group">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-textMain hover:bg-surface-hover rounded-lg transition-colors">
                      <ListTodo size={14} /> <span className="hidden sm:inline">Stato</span> <ChevronUp size={12} className="text-textMuted" />
                  </button>
                  <div className="absolute bottom-full left-0 mb-2 w-32 bg-surface border border-border rounded-lg shadow-xl overflow-hidden hidden group-hover:block animate-in fade-in zoom-in-95">
                      <button onClick={() => handleBulkStatusChange(TaskStatus.TODO)} className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover text-textMain flex items-center gap-2"><Circle size={10}/> Da Fare</button>
                      <button onClick={() => handleBulkStatusChange(TaskStatus.TEST)} className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover text-orange-500 flex items-center gap-2"><Clock size={10}/> Test</button>
                      <button onClick={() => handleBulkStatusChange(TaskStatus.DONE)} className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover text-green-500 flex items-center gap-2"><CheckCircle2 size={10}/> Fatto</button>
                  </div>
              </div>

              <div className="h-6 w-px bg-border"></div>

              <button 
                  type="button"
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                  <Trash2 size={14} /> <span className="hidden sm:inline">Elimina</span>
              </button>
              
              <button onClick={() => setSelectedTaskIds(new Set())} className="ml-2 text-textMuted hover:text-textMain"><X size={16} /></button>
          </div>
        )}

        <FirebaseConfigModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSave={saveConfig} />

        {aiModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in">
              <div className="p-5 border-b border-border flex justify-between items-center">
                 <h2 className="text-lg font-bold text-textMain flex items-center gap-2"><Sparkles size={20} className="text-purple-500" />Assistente AI</h2>
                 <button onClick={() => setAiModalOpen(false)} className="text-textMuted hover:text-textMain"><X size={20}/></button>
              </div>
              <div className="p-5">
                <p className="text-textMuted text-sm mb-4">Descrivi cosa vuoi realizzare e l'AI genererà i task.</p>
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Es: Landing page con form contatti..." className="w-full h-32 bg-background border border-border rounded-xl p-3 text-textMain focus:outline-none focus:border-purple-500 resize-none text-sm"></textarea>
                <div className="mt-4 flex justify-end gap-3">
                  <button onClick={() => setAiModalOpen(false)} className="px-4 py-2 text-sm text-textMuted hover:text-textMain transition-colors">Annulla</button>
                  <button onClick={generateAiTasks} disabled={isAiLoading || !aiPrompt.trim()} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-all disabled:opacity-50">{isAiLoading ? <><Loader2 className="animate-spin" size={16} />...</> : <><Sparkles size={16} />Genera</>}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingTask && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-border flex justify-between items-center">
                  <h3 className="font-bold text-textMain">Modifica Task</h3>
                  <button onClick={() => setEditingTask(null)} className="text-textMuted hover:text-textMain"><X size={20}/></button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                   <form id="editTaskForm" onSubmit={saveEditedTask} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-textMuted mb-1">TITOLO</label>
                        <textarea value={editingTask.title} onChange={(e) => setEditingTask({...editingTask, title: e.target.value})} className="w-full bg-background border border-border rounded-lg p-3 text-textMain focus:outline-none focus:border-primary min-h-[60px] resize-y" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-textMuted mb-1">NOTE</label>
                        <textarea value={editingTask.description || ''} onChange={(e) => setEditingTask({...editingTask, description: e.target.value})} className="w-full bg-background border border-border rounded-lg p-3 text-textMain focus:outline-none focus:border-primary min-h-[120px] resize-y" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-textMuted mb-1">STATO</label>
                            <div className="flex flex-col gap-2">
                            {[TaskStatus.TODO, TaskStatus.TEST, TaskStatus.DONE].map(status => (
                                <button type="button" key={status} onClick={() => setEditingTask({...editingTask, status})} className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all flex items-center justify-between ${editingTask.status === status ? 'bg-primary/20 border-primary text-primary' : 'bg-surface-hover border-border text-textMuted hover:bg-surface-hover'}`}>
                                    {status} {editingTask.status === status && <CheckCircle2 size={14}/>}
                                </button>
                            ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-textMuted mb-1">PRIORITÀ</label>
                            <div className="flex flex-col gap-2">
                            {[TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH].map(p => (
                                <button type="button" key={p} onClick={() => setEditingTask({...editingTask, priority: p})} className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all flex items-center justify-between ${editingTask.priority === p ? 'bg-surface-hover border-textMuted text-textMain' : 'bg-surface-hover border-border text-textMuted hover:bg-surface-hover'}`}>
                                    {p} {editingTask.priority === p && <CheckCircle2 size={14}/>}
                                </button>
                            ))}
                            </div>
                          </div>
                      </div>
                   </form>
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-3 bg-surface rounded-b-2xl">
                   <button type="button" onClick={() => setEditingTask(null)} className="px-4 py-2 text-sm text-textMuted hover:text-textMain">Annulla</button>
                   <button form="editTaskForm" type="submit" className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"><Save size={16} /> Salva</button>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}