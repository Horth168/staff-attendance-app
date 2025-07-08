import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserPlus, LogIn, LogOut, Users, ClipboardList, Clock, Languages, FileDown, CalendarDays, X, AlertCircle } from 'lucide-react';

// --- Translations & Constants ---
const translations = {
    en: {
        title: "Staff Attendance System",
        yourUserId: "Your User ID:",
        connecting: "Connecting...",
        addNewStaff: "Add New Staff",
        namePlaceholder: "e.g., Jane Doe",
        addStaffButton: "Add Staff",
        staffList: "Staff List",
        loadingData: "Loading data...",
        noStaff: "No staff added yet.",
        clockedIn: "Clocked In",
        clockedOut: "Clocked Out",
        dayOff: "Day Off",
        setDaysOff: "Set Days Off",
        attendanceLog: "Attendance Log",
        loadingLog: "Loading log...",
        noLog: "No attendance records yet.",
        staffMemberHeader: "Staff Member",
        eventHeader: "Event",
        timeHeader: "Time",
        notesHeader: "Notes",
        exportButton: "Export to Excel",
        selectDates: "Select Dates",
        saveButton: "Save",
        errorDuplicateStaff: "A staff member with this name already exists.",
        errorAddStaff: "Failed to add staff member. Please try again.",
        errorClockEvent: (status) => `Failed to record ${status}. Please try again.`,
    },
    km: {
        title: "ប្រព័ន្ធគ្រប់គ្រងវត្តមានបុគ្គលិក",
        yourUserId: "លេខសម្គាល់អ្នកប្រើប្រាស់:",
        connecting: "កំពុងភ្ជាប់...",
        addNewStaff: "បន្ថែមបុគ្គលិកថ្មី",
        namePlaceholder: "ឧទាហរណ៍៖ ចាន់ ដារ៉ា",
        addStaffButton: "បន្ថែមបុគ្គលិក",
        staffList: "បញ្ជីបុគ្គលិក",
        loadingData: "កំពុងទាញយកទិន្នន័យ...",
        noStaff: "មិនទាន់មានបុគ្គលិកបន្ថែមទេ",
        clockedIn: "បានចុះឈ្មោះចូល",
        clockedOut: "បានចុះឈ្មោះចេញ",
        dayOff: "ថ្ងៃ​ឈប់សម្រាក",
        setDaysOff: "កំណត់ថ្ងៃឈប់សម្រាក",
        attendanceLog: "កំណត់ត្រាវត្តមាន",
        loadingLog: "កំពុងទាញយកកំណត់ត្រា...",
        noLog: "មិនទាន់មានកំណត់ត្រាវត្តមានទេ",
        staffMemberHeader: "ឈ្មោះ​បុគ្គលិក",
        eventHeader: "ព្រឹត្តិការណ៍",
        timeHeader: "ពេលវេលា",
        notesHeader: "កំណត់ចំណាំ",
        exportButton: "នាំចេញជា Excel",
        selectDates: "ជ្រើសរើសកាលបរិច្ឆេទ",
        saveButton: "រក្សាទុក",
        errorDuplicateStaff: "បុគ្គលិកដែលមានឈ្មោះនេះមានរួចហើយ",
        errorAddStaff: "បរាជ័យក្នុងការបន្ថែមបុគ្គលិក។ សូម​ព្យាយាម​ម្តង​ទៀត។",
        errorClockEvent: (status) => `បរាជ័យក្នុងការកត់ត្រា ${status} ។ សូម​ព្យាយាម​ម្តង​ទៀត។`,
    }
};

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBRucRMWgeljEL0f4TxAs682GiBWYb6iow",
  authDomain: "my-staff-attendance.firebaseapp.com",
  projectId: "my-staff-attendance",
  storageBucket: "my-staff-attendance.firebasestorage.app",
  messagingSenderId: "395704458168",
  appId: "1:395704458168:web:a6f92c740811872cd58d4d",
  measurementId: "G-CBEYE7HHH6"
};

// --- Calendar Component ---
const CalendarModal = ({ staffMember, onClose, onSave, t, language }) => {
    const [selectedDates, setSelectedDates] = useState(() => 
        (staffMember.daysOff || []).map(d => {
            const [year, month, day] = d.split('-').map(Number);
            return new Date(year, month - 1, day);
        })
    );

    const handleDateClick = (date) => {
        const dateString = date.toDateString();
        const isSelected = selectedDates.some(d => d.toDateString() === dateString);
        if (isSelected) {
            setSelectedDates(selectedDates.filter(d => d.toDateString() !== dateString));
        } else {
            setSelectedDates([...selectedDates, date]);
        }
    };

    const handleSave = () => {
        const dateStrings = selectedDates.map(d => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        });
        onSave(staffMember.id, dateStrings);
        onClose();
    };
    
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const blanks = Array(firstDay).fill(null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        return (
            <div className="grid grid-cols-7 gap-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="font-semibold text-xs">{day}</div>)}
                {blanks.map((_, i) => <div key={`blank-${i}`}></div>)}
                {days.map(day => {
                    const date = new Date(year, month, day);
                    const dateString = date.toDateString();
                    const isSelected = selectedDates.some(d => d.toDateString() === dateString);
                    const isPast = date < new Date().setHours(0,0,0,0);
                    return (
                        <button 
                            key={day}
                            onClick={() => handleDateClick(date)}
                            disabled={isPast}
                            className={`p-2 rounded-full text-sm transition-colors ${
                                isSelected ? 'bg-indigo-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                            } ${isPast ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' : ''}`}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-md m-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{t.selectDates} - {staffMember.name}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>&lt;</button>
                    <div className="font-semibold">{currentMonth.toLocaleString(language, { month: 'long', year: 'numeric' })}</div>
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>&gt;</button>
                </div>
                {renderCalendar()}
                <div className="mt-6 flex justify-end">
                    <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">{t.saveButton}</button>
                </div>
            </div>
        </div>
    );
};


// --- Main App Component ---
export default function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isXlsxReady, setIsXlsxReady] = useState(false);
    const [today, setToday] = useState(() => new Date().toISOString().split('T')[0]);

    const [staff, setStaff] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [newStaffName, setNewStaffName] = useState('');
    
    const [isStaffLoading, setIsStaffLoading] = useState(true);
    const [isAttendanceLoading, setIsAttendanceLoading] = useState(true);

    const [error, setError] = useState(null);
    const [language, setLanguage] = useState('en');
    const [selectedStaff, setSelectedStaff] = useState(null);

    const t = translations[language];

    useEffect(() => {
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Khmer+OS+Siemreap&family=Noto+Sans+Khmer:wght@400;700&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
        script.onload = () => setIsXlsxReady(true);
        document.body.appendChild(script);
        
        const interval = setInterval(() => {
            setToday(new Date().toISOString().split('T')[0]);
        }, 60000);

        return () => {
            document.head.removeChild(fontLink);
            document.body.removeChild(script);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreInstance = getFirestore(app);
            const authInstance = getAuth(app);
            setDb(firestoreInstance); 
            setAuth(authInstance);
            const unsub = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    try {
                        await signInAnonymously(authInstance);
                    } catch (e) {
                        console.error("Anonymous sign-in failed:", e);
                        if (e.code === 'auth/configuration-not-found') {
                            setError("ACTION REQUIRED: Anonymous Sign-In is not enabled for this app. To fix this: 1) Go to your Firebase Console. 2) Select your project ('my-staff-attendance'). 3) Go to the 'Authentication' section. 4) Go to the 'Sign-in method' tab. 5) Find 'Anonymous' in the list and enable it.");
                        } else {
                            setError("Authentication failed. Please check your Firebase project settings and security rules.");
                        }
                    }
                }
                setIsAuthReady(true);
            });
            return () => unsub();
        } catch (e) {
            console.error("Firebase initialization error:", e);
            setError("Failed to initialize Firebase. Check that your `firebaseConfig` object is correct.");
        }
    }, []);

    useEffect(() => {
        if (!isAuthReady || !db || error) {
            if (isAuthReady || error) {
                setIsStaffLoading(false);
                setIsAttendanceLoading(false);
            }
            return;
        };
        
        const staffUnsub = onSnapshot(collection(db, `staff`), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
            setStaff(data);
            setIsStaffLoading(false);
        }, (err) => { 
            console.error(err); 
            setError("Could not fetch staff data. Check your Firestore security rules."); 
            setIsStaffLoading(false);
        });

        const attendUnsub = onSnapshot(collection(db, `attendance`), (snap) => {
            const data = snap.docs.map(d => {
                const docData = d.data();
                let timestamp = null;
                if (docData.timestamp && typeof docData.timestamp.toDate === 'function') {
                    timestamp = docData.timestamp.toDate();
                }
                return {
                    id: d.id,
                    ...docData,
                    timestamp: timestamp
                };
            }).sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
            
            setAttendance(data);
            setIsAttendanceLoading(false);
        }, (err) => { 
            console.error(err); 
            setError("Could not fetch attendance data. Check your Firestore security rules."); 
            setIsAttendanceLoading(false);
        });

        return () => { staffUnsub(); attendUnsub(); };
    }, [isAuthReady, db, error]);

    const handleAddStaff = async (e) => {
        e.preventDefault();
        if (!newStaffName.trim() || !db) return;
        if (staff.some(m => m.name.toLowerCase() === newStaffName.trim().toLowerCase())) {
            alert(t.errorDuplicateStaff); return;
        }
        try {
            await addDoc(collection(db, `staff`), { name: newStaffName.trim(), status: 'Clocked Out', daysOff: [], createdAt: serverTimestamp() });
            setNewStaffName('');
        } catch (err) { console.error(err); alert(t.errorAddStaff); }
    };

    const handleClockEvent = async (staffId, staffName, currentStatus) => {
        if (!db) return;
        const newStatus = currentStatus === 'Clocked In' ? 'Clocked Out' : 'Clocked In';
        try {
            setError(null);
            
            await addDoc(collection(db, `attendance`), { staffId, staffName, type: newStatus, timestamp: serverTimestamp() });
            
            await updateDoc(doc(db, `staff`, staffId), { status: newStatus, lastActivity: serverTimestamp() });

        } catch (err) {
            console.error("!!! CRITICAL ERROR in handleClockEvent:", err);
            setError(`Failed to save attendance log. This is a Firestore Security Rules issue. Please ensure your rules allow writes to the 'attendance' collection. (Error: ${err.message})`);
        }
    };

    const handleSaveDaysOff = async (staffId, dates) => {
        if (!db) return;
        try {
            await updateDoc(doc(db, `staff`, staffId), { daysOff: dates });
        } catch (err) { console.error("Error saving days off:", err); alert("Failed to save days off."); }
    };

    const handleExport = () => {
        if (!isXlsxReady || !window.XLSX) { alert("Export not ready."); return; }
        
        const allRecords = [];
        const staffWithDaysOff = staff.filter(s => s.daysOff && s.daysOff.length > 0);

        staffWithDaysOff.forEach(member => {
            member.daysOff.forEach(dayOffDate => {
                const [year, month, day] = dayOffDate.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                allRecords.push({
                    [t.staffMemberHeader]: member.name,
                    [t.eventHeader]: t.dayOff,
                    [t.timeHeader]: date.toLocaleDateString(language === 'km' ? 'km-KH' : 'en-US'),
                    [t.notesHeader]: t.dayOff
                });
            });
        });

        attendance.forEach(entry => {
            allRecords.push({
                [t.staffMemberHeader]: entry.staffName,
                [t.eventHeader]: getTranslatedStatus(entry.type, false),
                [t.timeHeader]: entry.timestamp ? entry.timestamp.toLocaleString(language === 'km' ? 'km-KH' : 'en-US') : '',
                [t.notesHeader]: ''
            });
        });

        allRecords.sort((a,b) => new Date(a[t.timeHeader]) - new Date(b[t.timeHeader]));

        const worksheet = window.XLSX.utils.json_to_sheet(allRecords);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Log");
        window.XLSX.writeFile(workbook, `Attendance-Log-${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const getTranslatedStatus = (status, isDayOff) => {
        if (isDayOff) return t.dayOff;
        if (status === 'Clocked In') return t.clockedIn;
        if (status === 'Clocked Out') return t.clockedOut;
        return status;
    };
    
    const fontClass = language === 'km' ? 'font-khmer' : 'font-sans';
    const isLoading = isStaffLoading || isAttendanceLoading;
    
    return (
        <>
            <style>{`.font-khmer { font-family: 'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif; }`}</style>
            <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${fontClass}`}>
                {selectedStaff && <CalendarModal staffMember={selectedStaff} onClose={() => setSelectedStaff(null)} onSave={handleSaveDaysOff} t={t} language={language} />}
                
                <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center flex-wrap">
                        <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                            <Clock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                               <Languages className="w-5 h-5 text-gray-500 dark:text-gray-400"/>
                                <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-sm rounded-md ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>English</button>
                                <button onClick={() => setLanguage('km')} className={`px-3 py-1 text-sm rounded-md ${language === 'km' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>ខ្មែរ</button>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full hidden md:block">
                                {userId ? `${t.yourUserId} ${userId}` : t.connecting}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6" role="alert">
                            <div className="flex">
                                <div className="py-1"><AlertCircle className="h-6 w-6 text-red-500 mr-4"/></div>
                                <div>
                                    <p className="font-bold">An error occurred</p>
                                    <p className="text-sm">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                         <div className="flex justify-center items-center p-16">
                            <p>{t.loadingData}</p>
                         </div>
                    ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-8">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                <h2 className="text-xl font-semibold flex items-center mb-4"><UserPlus className="w-6 h-6 mr-3 text-indigo-500" />{t.addNewStaff}</h2>
                                <form onSubmit={handleAddStaff} className="space-y-4"><input type="text" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder={t.namePlaceholder} className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"/><button type="submit" disabled={!newStaffName.trim()} className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 disabled:cursor-not-allowed transition-colors">{t.addStaffButton}</button></form>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                <h2 className="text-xl font-semibold flex items-center mb-4"><Users className="w-6 h-6 mr-3 text-indigo-500" />{t.staffList}</h2>
                                {staff.length === 0 ? (<p>{t.noStaff}</p>) : (
                                    <ul className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                        {staff.map((member) => {
                                            const isDayOff = (member.daysOff || []).includes(today);
                                            const statusText = getTranslatedStatus(member.status, isDayOff);
                                            const statusColor = isDayOff ? 'text-blue-500' : member.status === 'Clocked In' ? 'text-green-500' : 'text-red-500';
                                            return (
                                                <li key={member.id} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                                                            <p className={`text-sm font-semibold ${statusColor}`}>{statusText}</p>
                                                        </div>
                                                        <div className="flex space-x-2">
                                                            <button onClick={() => handleClockEvent(member.id, member.name, member.status)} disabled={isDayOff || member.status === 'Clocked In'} className="p-2 bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"><LogIn className="w-5 h-5" /></button>
                                                            <button onClick={() => handleClockEvent(member.id, member.name, member.status)} disabled={isDayOff || member.status === 'Clocked Out'} className="p-2 bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"><LogOut className="w-5 h-5" /></button>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setSelectedStaff(member)} className="flex items-center justify-center space-x-2 text-sm w-full py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                                                        <CalendarDays className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                                        <span>{t.setDaysOff}</span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold flex items-center"><ClipboardList className="w-6 h-6 mr-3 text-indigo-500" />{t.attendanceLog}</h2>
                                <button onClick={handleExport} disabled={!isXlsxReady || (attendance.length === 0 && staff.every(s => !s.daysOff || s.daysOff.length === 0))} className="flex items-center px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-300 dark:disabled:bg-green-800 disabled:cursor-not-allowed"><FileDown className="w-4 h-4 mr-2" />{t.exportButton}</button>
                            </div>
                            {attendance.length === 0 ? (<p>{t.noLog}</p>) : (
                                <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 sticky top-0"><tr><th scope="col" className="px-6 py-3">{t.staffMemberHeader}</th><th scope="col" className="px-6 py-3">{t.eventHeader}</th><th scope="col" className="px-6 py-3">{t.timeHeader}</th></tr></thead>
                                        <tbody>
                                            {attendance.map((entry) => (
                                                <tr key={entry.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50">
                                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{entry.staffName}</td>
                                                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${entry.type === 'Clocked In' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>{getTranslatedStatus(entry.type, false)}</span></td>
                                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{entry.timestamp ? entry.timestamp.toLocaleString(language === 'km' ? 'km-KH' : 'en-US') : '...'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </main>
            </div>
        </>
    );
}
