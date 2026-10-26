export type Status = 'todo' | 'progress' | 'review' | 'done'
export type Priority = 'High' | 'Medium' | 'Low'
export type Task = { id: any; title: string; description: string; projectId: string; status: Status; priority: Priority; due: string; assignee: string; initials: string; tone: string; labels: string[]; comments: string[] }
export type Project = { id: string; name: string; code: string; color: string; description: string; startDate?: string; due: string; members: string[]; state: 'On track' | 'At risk' | 'Archived' }

const seedProjects: Project[] = [
  { id:'website-redesign', name:'Website Redesign', code:'WEB', color:'#7664ef', description:'Turn the new brand direction into a delightful digital experience.', due:'Oct 24', members:['AM','JR','SK'], state:'On track' },
  { id:'mobile-app-2', name:'Mobile App 2.0', code:'APP', color:'#20b486', description:'Ship the next generation of the TeamFlow mobile experience.', due:'Nov 08', members:['SK','AM','ML'], state:'On track' },
  { id:'q4-marketing', name:'Q4 Marketing Campaign', code:'MKT', color:'#f08c46', description:'Build a high-intent campaign for the end-of-year launch.', due:'Nov 15', members:['JR','LP'], state:'At risk' },
  { id:'customer-research', name:'Customer Research', code:'RES', color:'#e15f88', description:'Turn customer interviews into clear product opportunities.', due:'Oct 30', members:['ML','AM'], state:'On track' },
]
const seedTasks: Task[] = [
  {id:1,title:'Polish onboarding experience',description:'Improve the first-run flow and remove friction from sign-up.',projectId:'website-redesign',status:'progress',priority:'High',due:'Today',assignee:'Alex Morgan',initials:'AM',tone:'violet',labels:['Design','UX'],comments:['The new empty state is ready for review.']},
  {id:2,title:'Set up analytics events',description:'Instrument the core product events for the mobile app.',projectId:'mobile-app-2',status:'todo',priority:'Medium',due:'Oct 18',assignee:'Jordan Reed',initials:'JR',tone:'orange',labels:['Engineering'],comments:[]},
  {id:3,title:'Review campaign concepts',description:'Review the three campaign directions with the marketing team.',projectId:'q4-marketing',status:'review',priority:'High',due:'Oct 19',assignee:'Sofia Kim',initials:'SK',tone:'mint',labels:['Marketing'],comments:[]},
  {id:4,title:'Update pricing page copy',description:'Refresh the pricing page language before the design handoff.',projectId:'website-redesign',status:'done',priority:'Low',due:'Oct 16',assignee:'Leo Park',initials:'LP',tone:'pink',labels:['Content'],comments:[]},
  {id:5,title:'Map customer interview themes',description:'Cluster notes into themes and identify recurring pain points.',projectId:'customer-research',status:'todo',priority:'Medium',due:'Oct 21',assignee:'Maya Lee',initials:'ML',tone:'blue',labels:['Research'],comments:[]},
  {id:6,title:'Finalize component library',description:'Document the new components and publish the library.',projectId:'website-redesign',status:'progress',priority:'High',due:'Oct 23',assignee:'Alex Morgan',initials:'AM',tone:'violet',labels:['Design','System'],comments:[]},
  {id:7,title:'Push beta build to TestFlight',description:'Prepare the beta release for internal testing.',projectId:'mobile-app-2',status:'done',priority:'High',due:'Oct 17',assignee:'Jordan Reed',initials:'JR',tone:'orange',labels:['Engineering'],comments:[]},
]
const key = (name: string) => `teamflow:${name}`
function read<T>(name: string, fallback: T): T { try { const value = localStorage.getItem(key(name)); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
function write<T>(name: string, value: T) { localStorage.setItem(key(name), JSON.stringify(value)); return value }
export const data = {
  projects: () => read<Project[]>('projects', seedProjects),
  tasks: () => read<Task[]>('tasks', seedTasks),
  saveProjects: (value: Project[]) => write('projects', value),
  saveTasks: (value: Task[]) => write('tasks', value),
  reset: () => { localStorage.removeItem(key('projects')); localStorage.removeItem(key('tasks')) },
}
