import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Archive,
  RotateCcw
} from 'lucide-react';
import { Project, Task, TaskStatus, TaskPriority, ViewMode } from './types';
import { generateTasksFromInput } from './services/geminiService';

// --- Components ---

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

  // Sync internal state if prop changes (external update)
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

  // Auto-resize
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
      rows={1}
      placeholder={placeholder}
      className={`w-full bg-transparent border border-transparent rounded px-1 -ml-1 resize-none overflow-hidden focus:bg-slate-800 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-primary transition-all whitespace-pre-wrap break-words ${isDone ? 'text-slate-500 line-through' : 'text-slate-200'} ${className}`}
    />
  );
};

// Component for Collapsible Description
const CollapsibleDescription = ({ text, onUpdate }: { text: string, onUpdate: (val: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    if (!text) return null;

    return (
        <div className="mt-2 w-full">
            {!isOpen ? (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-primary transition-colors select-none"
                >
                    <ChevronDown size={12} />
                    Mostra note ({text.split('\n')[0].substring(0, 30)}...)
                </button>
            ) : (
                <div className="bg-slate-900/50 rounded p-2 border border-slate-800/50 w-full animate-in fade-in zoom-in-95 duration-200">
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-1 text-[11px] text-primary hover:text-blue-300 font-medium mb-1 select-none"
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
  onCycleStatus: (task: Task) => void;
  onCyclePriority: (task: Task) => void;
  onUpdateTitle: (task: Task, newTitle: string) => void;
  onUpdateDescription: (task: Task, newDesc: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onRestore: (taskId: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  isDeletedView?: boolean;
}

const TaskItem: React.FC<TaskItemProps> = ({ 
  task, 
  viewMode, 
  onCycleStatus, 
  onCyclePriority, 
  onUpdateTitle, 
  onUpdateDescription,
  onEdit, 
  onDelete, 
  onRestore,
  onDragStart,
  isDeletedView = false
}) => (
  <div 
    draggable={!isDeletedView}
    onDragStart={(e) => !isDeletedView && onDragStart(e, task.id)}
    className={`group relative bg-surface rounded-xl border ${isDeletedView ? 'border-red-900/30 bg-red-950/10' : 'border-slate-700/50 hover:border-primary/40'} transition-all shadow-sm ${!isDeletedView && 'cursor-grab active:cursor-grabbing'} ${viewMode === 'LIST' ? 'flex flex-col md:flex-row md:items-start p-3 mb-2' : 'p-3 mb-3 flex flex-col'}`}
  >
    {/* Drag Handle */}
    {!isDeletedView && (
      <div className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
          <GripVertical size={14} />
      </div>
    )}

    <div className={`flex-1 min-w-0 ${viewMode === 'LIST' ? 'md:ml-3 md:mr-4' : 'mb-3'}`}>
      {isDeletedView ? (
        <span className="text-sm text-slate-400 line-through">{task.title}</span>
      ) : (
        <InlineEditableText 
            text={task.title} 
            isDone={task.status === TaskStatus.DONE} 
            onSave={(val) => onUpdateTitle(task, val)} 
            className="text-sm"
        />
      )}
      
      {!isDeletedView && viewMode === 'LIST' && task.description && (
        <CollapsibleDescription 
            text={task.description} 
            onUpdate={(val) => onUpdateDescription(task, val)}
        />
      )}
      {!isDeletedView && viewMode === 'KANBAN' && task.description && (
         <div className="mt-2 text-xs text-slate-500 line-clamp-3 whitespace-pre-wrap">{task.description}</div>
      )}
    </div>

    <div className={`flex items-center justify-between ${viewMode === 'LIST' ? 'gap-3 mt-2 md:mt-0 md:self-start' : 'w-full pt-2 border-t border-slate-700/50'}`}>
      <div className="flex items-center gap-2">
        {!isDeletedView && <StatusBadge status={task.status} onClick={() => onCycleStatus(task)} />}
        {!isDeletedView && <PriorityBadge priority={task.priority} onClick={() => onCyclePriority(task)} />}
        {isDeletedView && <span className="text-xs text-red-500 font-medium uppercase">Eliminato</span>}
      </div>
      
      <div className={`flex items-center gap-1 transition-opacity`}>
        {isDeletedView ? (
           <button 
             onClick={(e) => { e.stopPropagation(); onRestore(task.id); }} 
             className="p-1.5 text-slate-500 hover:text-green-400 hover:bg-slate-700 rounded transition-colors"
             title="Ripristina"
           >
             <RotateCcw size={14} />
           </button>
        ) : (
            <>
                <button 
                    onClick={() => onEdit(task)}
                    className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-700 rounded transition-colors"
                    title="Modifica dettaglio"
                >
                    <Pencil size={14} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} 
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                    title="Elimina"
                >
                    <Trash2 size={14} />
                </button>
            </>
        )}
      </div>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  // State
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('ft_projects');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('ft_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
     return localStorage.getItem('ft_activeProject') || null;
  });

  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newProjectInput, setNewProjectInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showTrash, setShowTrash] = useState(false); // Toggle for Trash view
  
  // Drag State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  
  // Editing states
  const [editingProjectName, setEditingProjectName] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Persistence
  useEffect(() => { localStorage.setItem('ft_projects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem('ft_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { 
    if (activeProjectId) localStorage.setItem('ft_activeProject', activeProjectId); 
  }, [activeProjectId]);

  // Init default project if none
  useEffect(() => {
    // Only init if there are ABSOLUTELY no projects (not even deleted ones) to avoid loops, 
    // but better to just check visible ones.
    const visibleProjects = projects.filter(p => !p.deletedAt);
    if (visibleProjects.length === 0 && projects.length === 0) {
      const defaultProject = { id: crypto.randomUUID(), name: 'Il Mio Primo Progetto', createdAt: Date.now() };
      setProjects([defaultProject]);
      setActiveProjectId(defaultProject.id);
    } else if (!activeProjectId && visibleProjects.length > 0) {
      setActiveProjectId(visibleProjects[0].id);
    }
  }, [projects.length, activeProjectId]);

  // Auto-resize title textarea in add form
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = titleTextareaRef.current.scrollHeight + 'px';
    }
  }, [newTaskTitle]);

  // Derived State
  const visibleProjects = useMemo(() => {
      return showTrash 
        ? projects.filter(p => p.deletedAt) 
        : projects.filter(p => !p.deletedAt);
  }, [projects, showTrash]);

  const activeTasks = useMemo(() => {
    const priorityWeight = {
        [TaskPriority.HIGH]: 3,
        [TaskPriority.MEDIUM]: 2,
        [TaskPriority.LOW]: 1
    };

    let filtered = tasks.filter(t => t.projectId === activeProjectId);
    
    // Filter based on Trash mode
    filtered = showTrash 
        ? filtered.filter(t => t.deletedAt) 
        : filtered.filter(t => !t.deletedAt);

    return filtered.sort((a, b) => {
        // 1. Sort by Priority (Descending: High -> Low)
        const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (pDiff !== 0) return pDiff;
        // 2. Sort by Title (Ascending: A -> Z)
        return a.title.localeCompare(b.title);
    });
  }, [tasks, activeProjectId, showTrash]);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);

  // Handlers
  const addProject = () => {
    if (!newProjectInput.trim()) return;
    const newProj: Project = { id: crypto.randomUUID(), name: newProjectInput, createdAt: Date.now() };
    setProjects([...projects, newProj]);
    setActiveProjectId(newProj.id);
    setNewProjectInput('');
    setShowTrash(false); // Switch to normal view
  };

  const renameProject = (newName: string) => {
    if (!activeProjectId || !newName.trim()) return;
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, name: newName.trim() } : p));
    setEditingProjectName(null);
  };

  const addTask = (title: string, desc: string) => {
    if (!activeProjectId || !title.trim()) return;
    const newTask: Task = {
      id: crypto.randomUUID(),
      projectId: activeProjectId,
      title: title.trim(),
      description: desc.trim(),
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      createdAt: Date.now()
    };
    setTasks(prev => [newTask, ...prev]);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); 
      document.getElementById('newTaskDesc')?.focus();
    }
  };

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

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  };

  const saveEditedTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim()) return;
    setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
    setEditingTask(null);
  };

  // Soft Delete Logic - No Window.confirm to prevent blocking
  const deleteTask = (taskId: string) => {
    updateTask(taskId, { deletedAt: Date.now() });
  };

  const restoreTask = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, deletedAt: undefined } : t));
  };

  const deleteProject = (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Soft delete project
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, deletedAt: Date.now() } : p));
    
    // If we deleted the active project, switch to another valid one
    if (activeProjectId === projId) {
        const remaining = projects.filter(p => p.id !== projId && !p.deletedAt);
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const restoreProject = (projId: string, e: React.MouseEvent) => {
     e.stopPropagation();
     setProjects(prev => prev.map(p => p.id === projId ? { ...p, deletedAt: undefined } : p));
  };

  // Drag & Drop Handlers
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

  const generateAiTasks = async () => {
    if (!activeProjectId || !aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const generated = await generateTasksFromInput(aiPrompt, activeProjectId);
      const newTasks = generated.map(t => ({
        id: crypto.randomUUID(),
        projectId: activeProjectId,
        title: t.title || "Untitled Task",
        description: t.description,
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        createdAt: Date.now()
      }));
      setTasks(prev => [...newTasks, ...prev]);
      setAiPrompt('');
      setAiModalOpen(false);
    } catch (error) {
      alert("Errore durante la generazione dei task. Verifica la tua API Key.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- Views ---

  const renderKanbanColumn = (status: TaskStatus, title: string, colorClass: string, borderColorClass: string) => {
    const colTasks = activeTasks.filter(t => t.status === status);
    return (
      <div 
        className="flex-1 min-w-[300px] flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-800/50 transition-colors"
        onDragOver={!showTrash ? onDragOver : undefined}
        onDrop={(e) => !showTrash && onDrop(e, status)}
      >
        <div className={`p-4 border-b ${borderColorClass} flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur-sm rounded-t-xl z-10`}>
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
              onCycleStatus={cycleStatus}
              onCyclePriority={cyclePriority}
              onUpdateTitle={(t, val) => updateTask(t.id, { title: val })}
              onUpdateDescription={(t, val) => updateTask(t.id, { description: val })}
              onEdit={setEditingTask}
              onDelete={deleteTask}
              onRestore={restoreTask}
              onDragStart={onDragStart}
              isDeletedView={showTrash}
            />
          ))}
          {colTasks.length === 0 && !showTrash && (
            <div className="h-24 border-2 border-dashed border-slate-800 rounded-lg flex items-center justify-center text-slate-700 text-xs pointer-events-none">
              Trascina qui i task
            </div>
          )}
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
          if (showTrash && groupTasks.length === 0) return null; // Don't show empty groups in trash

          return (
            <div 
                key={group.status} 
                onDragOver={!showTrash ? onDragOver : undefined}
                onDrop={(e) => !showTrash && onDrop(e, group.status)}
                className="rounded-xl min-h-[100px]"
            >
              <h3 className={`text-sm font-bold ${group.color} uppercase tracking-wider mb-3 px-1 flex items-center gap-2 border-b ${group.border} pb-2`}>
                 {group.label} <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{groupTasks.length}</span>
              </h3>
              <div className="space-y-2">
                {groupTasks.map(task => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    viewMode="LIST"
                    onCycleStatus={cycleStatus} 
                    onCyclePriority={cyclePriority}
                    onUpdateTitle={(t, val) => updateTask(t.id, { title: val })}
                    onUpdateDescription={(t, val) => updateTask(t.id, { description: val })}
                    onEdit={setEditingTask}
                    onDelete={deleteTask} 
                    onRestore={restoreTask}
                    onDragStart={onDragStart}
                    isDeletedView={showTrash}
                  />
                ))}
                {groupTasks.length === 0 && !showTrash && (
                     <div className="text-slate-600 text-xs italic p-4 text-center border border-dashed border-slate-800 rounded-lg">
                         Nessun task in questa lista. Trascina qui per spostare.
                     </div>
                )}
              </div>
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
             <div className="w-6 h-6 bg-gradient-to-br from-primary to-purple-600 rounded-md"></div>
             FastTrack
           </div>
           <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400"><X size={20}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2 px-2">
             <div className="text-xs font-semibold text-slate-500">PROGETTI {showTrash && "(CESTINO)"}</div>
             <button 
                onClick={() => setShowTrash(!showTrash)}
                className={`p-1 rounded hover:bg-slate-800 transition-colors ${showTrash ? 'text-red-400 bg-red-950/30' : 'text-slate-500'}`}
                title={showTrash ? "Torna ai progetti attivi" : "Vedi progetti eliminati"}
             >
                {showTrash ? <RotateCcw size={12}/> : <Archive size={12}/>}
             </button>
          </div>
          
          <div className="space-y-1">
            {visibleProjects.map(p => (
              <div 
                key={p.id}
                onClick={() => { setActiveProjectId(p.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${activeProjectId === p.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'}`}
              >
                <span className={`truncate flex-1 ${showTrash ? 'line-through opacity-70' : ''}`}>{p.name}</span>
                {showTrash ? (
                    <button 
                        onClick={(e) => restoreProject(p.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:bg-green-500/20 hover:text-green-400 p-1.5 rounded transition-all z-20"
                        title="Ripristina progetto"
                    >
                        <RotateCcw size={13} />
                    </button>
                ) : (
                    <button 
                        onClick={(e) => deleteProject(p.id, e)} 
                        className="opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 p-1.5 rounded transition-all z-20"
                        title="Elimina progetto"
                    >
                        <Trash2 size={13} />
                    </button>
                )}
              </div>
            ))}
            {visibleProjects.length === 0 && (
                <div className="px-3 py-4 text-xs text-slate-600 text-center italic">
                    {showTrash ? "Cestino vuoto" : "Nessun progetto"}
                </div>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-900/50 shrink-0">
           {!showTrash ? (
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
           ) : (
                <div className="text-center text-xs text-red-400 py-2 font-medium bg-red-950/20 rounded border border-red-900/30">
                    MODALITÀ CESTINO ATTIVA
                </div>
           )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        
        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg">
                <Menu size={20} />
              </button>
            )}
            
            {/* Project Rename Logic */}
            {activeProject && editingProjectName !== null && !showTrash ? (
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
              <div className="group flex items-center gap-3 overflow-hidden">
                <h1 className={`text-xl font-bold truncate ${showTrash ? 'text-red-400 line-through' : 'text-white'}`}>
                  {activeProject?.name || (showTrash ? "Seleziona un progetto dal cestino" : "Nessun Progetto Selezionato")}
                </h1>
                {activeProject && !showTrash && (
                  <button 
                    onClick={() => setEditingProjectName(activeProject.name)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-primary transition-all"
                    title="Rinomina Progetto"
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {showTrash && activeProject && (
                    <span className="text-xs bg-red-900/40 text-red-300 px-2 py-1 rounded">Progetto Eliminato</span>
                )}
              </div>
            )}
          </div>

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

        {/* Improved Input Area */}
        {activeProject && !showTrash && (
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
                             if (e.key === 'Enter' && e.shiftKey) {
                                 // Allow newline
                             } else if (e.key === 'Enter') {
                                 e.preventDefault();
                                 handleQuickAdd(e);
                             }
                        }}
                        placeholder="Note aggiuntive (Shift+Enter per a capo)..."
                        rows={1}
                        className="flex-1 bg-slate-900/30 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none min-h-[38px]"
                    />
                    
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
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 custom-scrollbar">
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
        
        {/* AI Modal */}
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
                    {isAiLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Generazione...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Genera Task
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Task Modal */}
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