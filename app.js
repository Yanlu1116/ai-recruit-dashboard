/* ============================================
 * AI Recruit Agent - Application Logic
 * JD 分析 → PDF 解析 → 智能评分 → 候选人排名
 * ============================================ */

// ========== PDF.js Worker ==========
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ========== SVG 图标系统 (Lucide 风格) ==========
const ICONS = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/><path d="M9 11a3 3 0 0 1 6 0"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  document: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  chartBar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 5 19"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 19 5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.56 3.5 3.5 0 0 0 .314 6.612A3.5 3.5 0 0 0 12 19.5V5z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.56 3.5 3.5 0 0 1-.314 6.612A3.5 3.5 0 0 1 12 19.5V5z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>',
  messageSquare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
  thumbsUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
  helpCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  thumbsDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm0-13H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg>',
  crosshair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>',
  trendingUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>'
};

function icon(name, size) {
  const s = size || 18;
  return '<span class="icon" style="width:' + s + 'px;height:' + s + 'px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">' + (ICONS[name] || '') + '</span>';
}

// ========== 技能数据库 (双语) ==========
const SKILLS_DB = {
  programming: {
    label: '编程语言',
    skills: ['Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R语言', 'MATLAB', 'Shell', 'Bash', 'Perl', 'Objective-C']
  },
  frontend: {
    label: '前端技术',
    skills: ['React', 'Vue', 'Vue.js', 'Angular', 'Next.js', 'Nuxt', 'HTML5', 'CSS3', 'Sass', 'Less', 'Tailwind', 'Bootstrap', 'jQuery', '微信小程序', 'Electron', 'Webpack', 'Vite', 'Redux', 'Pinia']
  },
  backend: {
    label: '后端框架',
    skills: ['Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot', 'Spring Cloud', 'Express', 'NestJS', 'Gin', 'Beego', 'Rails', 'Laravel', 'MyBatis', 'Tornado', 'Node.js']
  },
  database: {
    label: '数据库',
    skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Oracle', 'SQL Server', 'SQLite', 'Cassandra', 'ClickHouse', 'TiDB', 'DynamoDB', 'CouchDB', 'Neo4j']
  },
  cloud_devops: {
    label: '云与运维',
    skills: ['AWS', 'Azure', 'GCP', '阿里云', '腾讯云', '华为云', 'Docker', 'Kubernetes', 'K8s', 'Jenkins', 'GitLab CI', 'GitHub Actions', 'Terraform', 'Ansible', 'Prometheus', 'Grafana', 'Nginx', 'Linux', 'CI/CD', 'Microservices', '微服务']
  },
  data_ai: {
    label: '数据与AI',
    skills: ['机器学习', '深度学习', 'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Keras', 'NLP', '自然语言处理', '计算机视觉', 'Computer Vision', '数据分析', '数据挖掘', 'Data Mining', 'Pandas', 'NumPy', 'Scikit-learn', 'Spark', 'Hadoop', 'Flink', 'Kafka', 'LLM', '大模型', 'GPT', '强化学习', 'Reinforcement Learning', '推荐系统']
  },
  mobile: {
    label: '移动开发',
    skills: ['iOS', 'Android', 'Flutter', 'React Native', 'Xamarin', 'Unity']
  },
  soft_skills: {
    label: '软技能',
    skills: ['领导力', '团队管理', 'Team Management', '项目管理', 'Project Management', '沟通能力', 'Communication', '团队协作', 'Collaboration', '问题解决', 'Problem Solving', '敏捷开发', 'Agile', 'Scrum', '跨部门协作', '抗压能力', '学习能力', '自驱力']
  }
};

// ========== 技能近义词/别名映射 (用于模糊匹配) ==========
const SKILL_ALIASES = {
  // 编程语言
  'Go': ['Golang', 'Go语言', 'Go 语言'],
  'Golang': ['Go', 'Go语言', 'Go 语言'],
  'R语言': ['R', 'R Language', 'R语言编程'],
  'Bash': ['Shell', 'Shell脚本', 'Bash脚本', 'Shell Script'],
  'Shell': ['Bash', 'Shell脚本', 'Bash脚本', 'Shell Script'],
  'C++': ['C Plus Plus', 'CPP', 'C/C++'],
  'C#': ['CSharp', 'C Sharp', 'C#.NET', '.NET Core'],
  // 前端
  'Vue': ['Vue.js', 'VueJS', 'Vue2', 'Vue3', 'Vue 2', 'Vue 3'],
  'Vue.js': ['Vue', 'VueJS', 'Vue2', 'Vue3'],
  'React': ['ReactJS', 'React.js', 'React JS', 'ReactJS'],
  'Angular': ['AngularJS', 'Angular.js', 'ng'],
  'HTML5': ['HTML', 'HTML 5'],
  'CSS3': ['CSS', 'CSS 3', '层叠样式表'],
  'Tailwind': ['TailwindCSS', 'Tailwind CSS'],
  // 后端
  'Spring': ['Spring Framework', 'SpringBoot'],
  'Spring Boot': ['SpringBoot', 'Spring Framework Boot', 'SpringBoot框架'],
  'Node.js': ['NodeJS', 'Node', 'Node JS', 'Nodejs'],
  // 数据库
  'PostgreSQL': ['Postgres', 'PG', 'PGSQL'],
  'MongoDB': ['Mongo', 'Mongo DB'],
  'Elasticsearch': ['ES', 'Elastic Search', 'Elastic', 'ELK'],
  'SQL Server': ['MSSQL', 'MS SQL', 'SQLServer'],
  'ClickHouse': ['Click House', 'CH'],
  // 云与运维
  'Kubernetes': ['K8s', 'k8s', 'Kubernetes集群', '容器编排'],
  'K8s': ['Kubernetes', 'k8s集群'],
  'Docker': ['容器化', 'Container', 'Docker容器', 'Docker化'],
  'CI/CD': ['CICD', '持续集成', '持续部署', 'Continuous Integration', 'Continuous Deployment'],
  'Microservices': ['微服务', '微服务架构', 'Microservice', 'Micro-services'],
  '微服务': ['Microservices', 'Microservice', '微服务架构'],
  'AWS': ['Amazon Web Services', 'Amazon云', 'EC2', 'S3', 'Lambda', '亚马逊云'],
  'Azure': ['Microsoft Azure', '微软云'],
  'GCP': ['Google Cloud', 'Google Cloud Platform', '谷歌云'],
  '阿里云': ['Alibaba Cloud', 'Aliyun', 'ACS', 'ACK'],
  '腾讯云': ['Tencent Cloud', 'TKE'],
  'Jenkins': ['Jenkins CI', 'Jenkins流水线'],
  'GitLab CI': ['GitLabCI', 'Gitlab CI/CD', 'GitLab Pipeline'],
  'GitHub Actions': ['Github Actions', 'GHA'],
  'Nginx': ['Nginx反向代理', 'Nginx负载均衡'],
  // 数据与AI
  '机器学习': ['Machine Learning', 'ML', '机器学习算法', 'ML算法'],
  'Machine Learning': ['机器学习', 'ML', '机器学习算法'],
  '深度学习': ['Deep Learning', 'DL', '深度学习模型', '神经网络', 'Neural Network'],
  'Deep Learning': ['深度学习', 'DL', '神经网络', 'Neural Network'],
  'NLP': ['自然语言处理', 'Natural Language Processing', '文本处理', 'Text Processing'],
  '自然语言处理': ['NLP', 'Natural Language Processing', '文本处理'],
  '计算机视觉': ['Computer Vision', 'CV', '图像处理', 'Image Processing', '视觉算法'],
  'Computer Vision': ['计算机视觉', 'CV', '图像处理', '视觉算法'],
  'TensorFlow': ['TF', 'Tensorflow', 'TF框架'],
  'PyTorch': ['Pytorch', 'Torch'],
  'Spark': ['Apache Spark', 'Spark计算', 'Spark集群'],
  'Hadoop': ['Hadoop生态', 'HDFS', 'MapReduce'],
  'Kafka': ['Apache Kafka', '消息队列', 'Message Queue', 'MQ'],
  'LLM': ['大模型', '大语言模型', 'Large Language Model', 'GPT', 'ChatGPT', 'LLaMA'],
  '大模型': ['LLM', '大语言模型', 'Large Language Model', 'GPT', 'ChatGPT'],
  'GPT': ['LLM', '大模型', 'ChatGPT', 'OpenAI', 'GPT-4', 'GPT3'],
  '强化学习': ['Reinforcement Learning', 'RL', '强化学习算法'],
  'Reinforcement Learning': ['强化学习', 'RL'],
  '数据分析': ['Data Analysis', '数据分析经验', '数据洞察'],
  '数据挖掘': ['Data Mining', 'DM', '数据挖掘算法'],
  'Data Mining': ['数据挖掘', 'DM'],
  'Pandas': ['Pandas库', 'Python Pandas'],
  'NumPy': ['Numpy', 'Python NumPy', 'NP'],
  'Scikit-learn': ['Sklearn', 'Scikit Learn', 'sklearn'],
  // 移动
  'iOS': ['iPhone', 'iPad', 'Swift开发', 'iOS开发'],
  'Android': ['安卓', 'Android开发', 'Kotlin开发'],
  'Flutter': ['Dart', 'Flutter框架'],
  'React Native': ['RN', 'ReactNative'],
  // 软技能
  '团队管理': ['Team Management', '团队管理经验', '带团队', '管理团队', 'People Management'],
  'Team Management': ['团队管理', '带团队', '管理团队'],
  '项目管理': ['Project Management', 'PMP', '项目推进', '项目管理经验'],
  'Project Management': ['项目管理', 'PMP', '项目推进'],
  '沟通能力': ['Communication', '沟通', '跨团队沟通', '沟通协作'],
  'Communication': ['沟通能力', '沟通', '跨团队沟通'],
  '团队协作': ['Collaboration', '协作', '团队合作', '团队配合', 'Teamwork'],
  'Collaboration': ['团队协作', '协作', '团队合作', 'Teamwork'],
  '问题解决': ['Problem Solving', '解决问题', '问题排查', 'Troubleshooting'],
  'Problem Solving': ['问题解决', '解决问题', '问题排查', 'Troubleshooting'],
  '敏捷开发': ['Agile', '敏捷', 'Scrum', '敏捷迭代'],
  'Agile': ['敏捷开发', '敏捷', 'Scrum', '敏捷迭代'],
  'Scrum': ['敏捷开发', 'Agile', 'Scrum流程', 'Scrum Master'],
  '领导力': ['Leadership', '领导', '带领团队', '技术领导'],
  '学习能力': ['快速学习', 'Learning Ability', '自我学习', '持续学习'],
  '自驱力': ['自我驱动', 'Self-driven', 'Self-motivated', '主动性']
};

// 获取技能的所有近义词（含自身）
function getSkillVariants(skill) {
  const lower = skill.toLowerCase();
  const variants = [lower];
  if (SKILL_ALIASES[skill]) {
    SKILL_ALIASES[skill].forEach(a => variants.push(a.toLowerCase()));
  }
  // 也检查反向映射
  for (const [key, aliases] of Object.entries(SKILL_ALIASES)) {
    if (aliases.includes(skill)) {
      variants.push(key.toLowerCase());
      aliases.forEach(a => variants.push(a.toLowerCase()));
    }
  }
  return [...new Set(variants)];
}

// 检查简历文本中是否包含某技能或其近义词
function isSkillInText(skill, textLower) {
  const variants = getSkillVariants(skill);
  for (const v of variants) {
    if (textLower.includes(v)) return true;
    // 词边界检查（防止 "go" 匹配 "good"）
    if (v.length <= 3 && /^[a-z]+$/.test(v)) {
      const regex = new RegExp('\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (regex.test(textLower)) return true;
    }
  }
  return false;
}

// 学历等级映射
const EDU_LEVELS = {
  '博士': 4, 'PhD': 4, 'Doctor': 4, '博士后': 5,
  '硕士': 3, 'Master': 3, 'MBA': 3, 'MPA': 3,
  '本科': 2, '学士': 2, 'Bachelor': 2,
  '大专': 1, '专科': 1, 'Associate': 1,
  '高中': 0, 'High School': 0
};

// ========== 状态管理 ==========
const state = {
  step: 1,
  jdText: '',
  jdAnalysis: null,
  resumes: [],
  analyzing: false
};

// ========== DOM 辅助 ==========
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

// ========== 步骤导航 ==========
function goToStep(step) {
  state.step = step;
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#screen-' + step).classList.add('active');
  updateStepNav(step);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepNav(currentStep) {
  $$('.step-item').forEach((item, i) => {
    item.classList.remove('active', 'done');
    if (i + 1 < currentStep) {
      item.classList.add('done');
    } else if (i + 1 === currentStep) {
      item.classList.add('active');
    }
  });
  $$('.step-connector').forEach((c, i) => {
    c.classList.toggle('active', i + 1 < currentStep);
  });
}

// ========== JD 分析引擎 ==========
function analyzeJD(text) {
  const jdLower = text.toLowerCase();

  // 1. 提取技能
  const foundSkills = [];
  for (const [cat, data] of Object.entries(SKILLS_DB)) {
    for (const skill of data.skills) {
      const skillLower = skill.toLowerCase();
      const alreadyFound = foundSkills.some(s =>
        s.skill.toLowerCase().includes(skillLower) || skillLower.includes(s.skill.toLowerCase())
      );
      if (!alreadyFound && jdLower.includes(skillLower)) {
        foundSkills.push({ skill, category: cat, label: data.label });
      }
    }
  }

  // 2. 提取经验要求
  let requiredYears = 0;
  const yearPatterns = [
    /(\d+)\s*[\+以上]*\s*(年|years?|yrs?|年工作经验|年开发经验)/gi,
    /(\d+)\s*[\+]*\s*(年|years?)/gi
  ];
  for (const pattern of yearPatterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[0].match(/\d+/)[0]);
      if (num > requiredYears && num <= 20) requiredYears = num;
    }
  }

  // 3. 提取学历要求
  const foundEducation = [];
  for (const [edu, level] of Object.entries(EDU_LEVELS)) {
    if (text.includes(edu)) {
      foundEducation.push({ name: edu, level });
    }
  }
  const maxEduLevel = foundEducation.length > 0
    ? Math.max(...foundEducation.map(e => e.level))
    : 0;
  const eduRequirement = foundEducation.length > 0
    ? foundEducation.find(e => e.level === maxEduLevel)
    : null;

  // 4. 提取经验级别关键词
  const seniorityKeywords = {
    '资深': 4, '高级': 3, 'Senior': 3, 'Lead': 4, '专家': 5, 'Staff': 5, 'Principal': 5,
    '中级': 2, 'Mid': 2,
    '初级': 1, 'Junior': 1
  };
  let seniority = 0;
  for (const [kw, level] of Object.entries(seniorityKeywords)) {
    if (jdLower.includes(kw.toLowerCase()) && level > seniority) {
      seniority = level;
    }
  }

  // 5. 生成评分标准（权重分配）
  const totalWeight = 100;
  const skillWeight = foundSkills.length > 0 ? 50 : 0;
  const expWeight = requiredYears > 0 ? 25 : 0;
  const eduWeight = eduRequirement ? 15 : 0;
  const remainingWeight = totalWeight - skillWeight - expWeight - eduWeight;
  const keywordWeight = remainingWeight > 0 ? remainingWeight : 10;

  const criteria = {
    skills: {
      label: '技能匹配',
      weight: skillWeight,
      items: foundSkills.map(s => s.skill),
      detail: foundSkills
    },
    experience: {
      label: '工作经验',
      weight: expWeight,
      requiredYears: requiredYears,
      seniority: seniority
    },
    education: {
      label: '学历匹配',
      weight: eduWeight,
      requirement: eduRequirement
    },
    keywords: {
      label: '关键词相关性',
      weight: keywordWeight
    }
  };

  return {
    skills: foundSkills,
    requiredYears,
    education: foundEducation,
    eduRequirement,
    seniority,
    criteria,
    rawText: text
  };
}

// ========== 经验年限提取 ==========
function extractExperienceYears(text) {
  let years = 0;

  const expPatterns = [
    /(\d+)\s*年\s*(经验|工作经验|开发经验|工作经历)/g,
    /(\d+)\s*\+?\s*years?\s*(of)?\s*(experience|exp)?/gi
  ];
  for (const pattern of expPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      const num = parseInt(m[1]);
      if (num > years && num <= 40) years = num;
    }
  }

  const dateRanges = [];
  const rangePattern = /(\d{4})[\.\-/年]\s*(\d{1,2})?[\.\-/月]?\s*[-–至~到]\s*(\d{4})[\.\-/年]\s*(\d{1,2})?|(\d{4})[\.\-/年]\s*[-–至~到]\s*(至今|现在|present|now|当前)/gi;
  const rangeMatches = [...text.matchAll(rangePattern)];
  const currentYear = new Date().getFullYear();
  for (const m of rangeMatches) {
    let startYear, endYear;
    if (m[1] && m[3]) {
      startYear = parseInt(m[1]);
      endYear = parseInt(m[3]);
    } else if (m[5]) {
      startYear = parseInt(m[5]);
      endYear = currentYear;
    } else {
      continue;
    }
    if (startYear > 1980 && startYear < currentYear + 1 && endYear >= startYear) {
      dateRanges.push({ start: startYear, end: endYear });
    }
  }

  if (dateRanges.length > 0) {
    dateRanges.sort((a, b) => a.start - b.start);
    let totalMonths = 0;
    let merged = [dateRanges[0]];
    for (let i = 1; i < dateRanges.length; i++) {
      const last = merged[merged.length - 1];
      if (dateRanges[i].start <= last.end) {
        last.end = Math.max(last.end, dateRanges[i].end);
      } else {
        merged.push(dateRanges[i]);
      }
    }
    for (const r of merged) {
      totalMonths += (r.end - r.start) * 12;
    }
    const calculatedYears = totalMonths / 12;
    if (calculatedYears > years) years = Math.round(calculatedYears);
  }

  return years;
}

// ========== 学历提取 ==========
function extractEducation(text) {
  let maxLevel = 0;
  let matchedEdu = null;
  for (const [edu, level] of Object.entries(EDU_LEVELS)) {
    if (text.includes(edu) && level > maxLevel) {
      maxLevel = level;
      matchedEdu = edu;
    }
  }
  const isTopSchool = /985|211|清华|北大|浙大|复旦|上海交大|交通大学|中科院|MIT|Stanford|CMU|Berkeley/i.test(text);
  return { level: maxLevel, name: matchedEdu, isTopSchool };
}

// ========== 关键词提取（用于密度计算） ==========
function extractKeywords(text) {
  const stopwords = new Set(['的', '了', '和', '与', '及', '或', '在', '为', '是', '对', '由', '从', '到', '等', '中', '可', '以', '将', '被', '其', '该', '此', '一个', '进行', '通过', '基于', '具有', '需要', '要求', '优先', '职责', '描述', '岗位', '职位', '工作', '公司', '团队', '部门', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'with', 'for', 'and', 'or', 'not', 'but', 'in', 'on', 'at', 'to', 'of', 'from', 'by', 'as']);
  const words = text.split(/[\s,，。.;；:：!！?？()（）\[\]【】、\n\r\t|/\\]+/);
  const freq = {};
  for (const w of words) {
    const word = w.trim();
    if (word.length < 2 || stopwords.has(word.toLowerCase())) continue;
    freq[word] = (freq[word] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(e => e[0]);
}

// ========== JD 职责提取 ==========
function extractResponsibilities(jdText) {
  const lines = jdText.split('\n');
  const responsibilities = [];
  const patterns = [
    /^\d+[\.、]\s*(负责|参与|主导|设计|优化|搭建|开发|实现|管理|保障|推动|带领|完成)/,
    /^[-•]\s*(负责|参与|主导|设计|优化|搭建|开发|实现|管理|保障|推动|带领|完成)/
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    for (const p of patterns) {
      if (p.test(trimmed)) {
        const cleaned = trimmed.replace(/^\d+[\.、]\s*/, '').replace(/^[-•]\s*/, '');
        responsibilities.push(cleaned);
        break;
      }
    }
  }
  if (responsibilities.length === 0) {
    const sentences = jdText.split(/[。；.;]/);
    for (const s of sentences) {
      if (/负责|参与|设计|优化|搭建|管理|推动/.test(s) && s.trim().length > 10) {
        responsibilities.push(s.trim());
        if (responsibilities.length >= 3) break;
      }
    }
  }
  return responsibilities.slice(0, 6);
}

// ========== 面试题目生成 ==========
function generateInterviewQuestions(resume, jdAnalysis) {
  const scores = resume.scores;
  const matchedSkills = scores.skillMatch.matched;
  const missingSkills = scores.skillMatch.missing;
  const responsibilities = extractResponsibilities(jdAnalysis.rawText);
  const actualYears = scores.experience.actual;
  const requiredYears = jdAnalysis.requiredYears || 0;

  const questions = [];

  // ---- Q1: 技能深挖题 ----
  if (matchedSkills.length > 0) {
    const techSkills = matchedSkills.filter(s => {
      const found = jdAnalysis.skills.find(js => js.skill === s);
      return found && found.category !== 'soft_skills';
    });
    const pickSkill = techSkills.length > 0 ? techSkills[0] : matchedSkills[0];
    const skillContext = jdAnalysis.skills.find(s => s.skill === pickSkill);

    const templates = [
      `你的简历中提到熟悉 ${pickSkill}。请结合实际项目经验，描述你在使用 ${pickSkill} 时遇到过最大的技术挑战是什么？你是如何排查和解决的？`,
      `JD 要求熟练掌握 ${pickSkill}，你的简历也体现了相关经验。请详细说明你在项目中如何运用 ${pickSkill} 进行架构设计或性能优化？有哪些关键的设计决策？`,
      `请描述一个你使用 ${pickSkill} 主导完成的核心项目。从需求分析到上线，你在这个过程中承担了哪些角色？解决了哪些难点？`
    ];
    const reason = skillContext && skillContext.category !== 'soft_skills'
      ? `针对匹配技术技能「${pickSkill}」(${skillContext.label})，深入验证真实项目深度`
      : `针对匹配技能「${pickSkill}」，验证实际掌握程度`;

    questions.push({
      type: 'skill_depth',
      label: '技能深挖',
      icon: 'crosshair',
      question: templates[Math.floor(Math.random() * templates.length)],
      reason
    });
  } else {
    questions.push({
      type: 'skill_depth',
      label: '技能深挖',
      icon: 'crosshair',
      question: `JD 要求多项技术技能，但简历中匹配项较少。请介绍你最擅长的技术领域，以及你在该领域中的核心项目经验和深度理解。`,
      reason: '匹配技能较少，需确认候选人核心技术能力'
    });
  }

  // ---- Q2: 能力探测题 ----
  if (missingSkills.length > 0) {
    const missingTech = missingSkills.filter(s => {
      const found = jdAnalysis.skills.find(js => js.skill === s);
      return found && found.category !== 'soft_skills';
    });
    const pickMissing = missingTech.length > 0 ? missingTech[0] : missingSkills[0];

    const templates = [
      `本岗位要求使用 ${pickMissing}，但你的简历中暂未体现相关经验。请谈谈你对 ${pickMissing} 的了解程度？如果有相关接触或学习计划，请具体说明。`,
      `JD 明确要求 ${pickMissing} 能力，你的过往经历中是否有过间接接触（如学习、业余项目、同事协作）？你计划如何快速补齐这项技能？`,
      `你在之前的项目中是否遇到过需要 ${pickMissing} 的场景但使用了替代方案？请描述当时的技术选型考量，以及你对 ${pickMissing} 在本岗位中应用场景的理解。`
    ];
    questions.push({
      type: 'gap_probe',
      label: '能力探测',
      icon: 'search',
      question: templates[Math.floor(Math.random() * templates.length)],
      reason: `针对缺失关键技能「${pickMissing}」，评估学习潜力和认知深度`
    });
  } else {
    const deepSkill = matchedSkills.length > 1 ? matchedSkills[1] : matchedSkills[0];
    questions.push({
      type: 'gap_probe',
      label: '能力探测',
      icon: 'search',
      question: `你的技能覆盖了 JD 全部要求，请问在这些技能中，哪个是你最需要持续精进的方向？你目前在该方向上的学习和实践计划是什么？`,
      reason: '技能完全匹配，探测持续成长意愿和自我认知'
    });
  }

  // ---- Q3: 场景/系统设计题 ----
  if (responsibilities.length > 0) {
    const pickResp = responsibilities[Math.floor(Math.random() * responsibilities.length)];
    const yearsRef = actualYears > 0 ? `${actualYears}年` : '';
    const templates = [
      `假设你入职后需要${pickResp}。请从方案设计、技术选型和风险预案三个维度，描述你的整体思路和落地步骤。`,
      `本岗位的核心职责之一是${pickResp}。结合你${yearsRef ? ' ' + yearsRef + ' 的' : ''}经验，你会如何规划前 90 天来快速推动这项工作的落地？`,
      `如果让你负责${pickResp}，你会如何评估这个任务的优先级和技术可行性？请举例说明你在过往项目中类似决策的思路。`
    ];
    questions.push({
      type: 'scenario',
      label: '场景设计',
      icon: 'layers',
      question: templates[Math.floor(Math.random() * templates.length)],
      reason: `针对 JD 核心职责「${pickResp.substring(0, 30)}...」，考察系统性思维和落地能力`
    });
  } else {
    questions.push({
      type: 'scenario',
      label: '场景设计',
      icon: 'layers',
      question: `请描述一个你在过往工作中主导的技术方案（从立项到交付），包括你遇到的最大阻碍、如何决策、以及最终结果。这有助于我们评估你面对复杂场景时的思维方式。`,
      reason: 'JD 职责未明确提取，考察通用系统性思维'
    });
  }

  return questions;
}

// ========== 评分引擎 ==========
function scoreResume(resumeText, jdAnalysis) {
  const resumeLower = resumeText.toLowerCase();
  const result = {
    skillMatch: { score: 0, weight: 0, matched: [], missing: [] },
    experience: { score: 0, weight: 0, actual: 0, required: 0 },
    education: { score: 0, weight: 0, actual: '', required: '' },
    keywordDensity: { score: 0, weight: 0 },
    total: 0,
    recommendation: '',
    highlights: []
  };

  // === 1. 技能匹配评分（模糊匹配） ===
  const criteria = jdAnalysis.criteria;
  const skills = jdAnalysis.skills;
  const skillWeight = criteria.skills.weight;

  if (skills.length > 0 && skillWeight > 0) {
    let matchedCount = 0;
    for (const skillObj of skills) {
      // 使用模糊匹配：检查技能及其近义词
      if (isSkillInText(skillObj.skill, resumeLower)) {
        matchedCount++;
        result.skillMatch.matched.push(skillObj.skill);
        result.highlights.push(`匹配技能: ${skillObj.skill}`);
      } else {
        result.skillMatch.missing.push(skillObj.skill);
      }
    }
    result.skillMatch.score = Math.round((matchedCount / skills.length) * 100);
    result.skillMatch.weight = skillWeight;
  } else {
    result.skillMatch.score = 50;
    result.skillMatch.weight = 50;
  }

  // === 2. 经验匹配评分 ===
  const expWeight = criteria.experience.weight;
  const requiredYears = criteria.experience.requiredYears;
  const actualYears = extractExperienceYears(resumeText);
  result.experience.actual = actualYears;
  result.experience.required = requiredYears;

  if (expWeight > 0 && requiredYears > 0) {
    const ratio = actualYears / requiredYears;
    if (ratio >= 1) {
      result.experience.score = Math.min(100, 80 + Math.round((ratio - 1) * 20));
    } else {
      result.experience.score = Math.round(ratio * 80);
    }
    result.experience.weight = expWeight;
    if (actualYears >= requiredYears) {
      result.highlights.push(`经验达标: ${actualYears}年 (要求 ${requiredYears}年)`);
    } else {
      result.highlights.push(`经验不足: ${actualYears}年 (要求 ${requiredYears}年)`);
    }
  } else {
    result.experience.score = Math.min(100, actualYears * 12);
    result.experience.weight = expWeight > 0 ? expWeight : 25;
  }

  // === 3. 学历匹配评分 ===
  const eduWeight = criteria.education.weight;
  const eduInfo = extractEducation(resumeText);
  result.education.actual = eduInfo.name || '未识别';

  if (eduWeight > 0 && jdAnalysis.eduRequirement) {
    result.education.required = jdAnalysis.eduRequirement.name;
    if (eduInfo.level >= jdAnalysis.eduRequirement.level) {
      result.education.score = eduInfo.isTopSchool ? 100 : 90;
      result.highlights.push(`学历达标: ${eduInfo.name}${eduInfo.isTopSchool ? ' (重点院校)' : ''}`);
    } else {
      result.education.score = Math.round((eduInfo.level / jdAnalysis.eduRequirement.level) * 60);
      result.highlights.push(`学历未达标: ${eduInfo.name || '未识别'} (要求 ${jdAnalysis.eduRequirement.name})`);
    }
    result.education.weight = eduWeight;
  } else {
    result.education.score = eduInfo.level > 0 ? Math.min(100, eduInfo.level * 25) : 30;
    result.education.weight = eduWeight > 0 ? eduWeight : 15;
  }

  // === 4. 关键词密度评分 ===
  const kwWeight = criteria.keywords.weight;
  const jdKeywords = extractKeywords(jdAnalysis.rawText);
  const resumeKeywords = extractKeywords(resumeText);
  const jdKwSet = new Set(jdKeywords);
  const resumeKwSet = new Set(resumeKeywords);
  let overlap = 0;
  for (const kw of jdKwSet) {
    if (resumeKwSet.has(kw)) overlap++;
  }
  result.keywordDensity.score = jdKeywords.length > 0
    ? Math.round((overlap / Math.min(jdKeywords.length, 30)) * 100)
    : 50;
  result.keywordDensity.weight = kwWeight > 0 ? kwWeight : 10;

  // === 计算综合得分 ===
  result.total = Math.round(
    result.skillMatch.score * (result.skillMatch.weight / 100) +
    result.experience.score * (result.experience.weight / 100) +
    result.education.score * (result.education.weight / 100) +
    result.keywordDensity.score * (result.keywordDensity.weight / 100)
  );

  // === 生成推荐意见 ===
  if (result.total >= 80) {
    result.recommendation = 'strong';
  } else if (result.total >= 65) {
    result.recommendation = 'good';
  } else if (result.total >= 45) {
    result.recommendation = 'medium';
  } else {
    result.recommendation = 'low';
  }

  return result;
}

// ========== PDF 解析 ==========
async function parsePDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }

  return fullText.trim();
}

// ========== JD 预览渲染 ==========
function renderJDPreview(analysis) {
  const container = $('#jdPreviewTags');
  container.innerHTML = '';

  analysis.skills.forEach(s => {
    const tag = document.createElement('span');
    tag.className = 'preview-tag tag-skill';
    tag.textContent = s.skill;
    container.appendChild(tag);
  });

  if (analysis.requiredYears > 0) {
    const tag = document.createElement('span');
    tag.className = 'preview-tag tag-exp';
    tag.textContent = `${analysis.requiredYears}+年经验`;
    container.appendChild(tag);
  }

  if (analysis.eduRequirement) {
    const tag = document.createElement('span');
    tag.className = 'preview-tag tag-edu';
    tag.textContent = analysis.eduRequirement.name + '及以上';
    container.appendChild(tag);
  }

  const softSkills = analysis.skills.filter(s => s.category === 'soft_skills');
  softSkills.forEach(s => {
    const tag = document.createElement('span');
    tag.className = 'preview-tag tag-soft';
    tag.textContent = s.skill;
    container.appendChild(tag);
  });

  $('#jdPreview').style.display = analysis.skills.length > 0 || analysis.requiredYears > 0 ? 'block' : 'none';
}

// ========== 文件列表渲染 ==========
function renderFileList() {
  const container = $('#fileList');
  container.innerHTML = '';

  state.resumes.forEach((resume, idx) => {
    const item = document.createElement('div');
    item.className = `file-item ${resume.status}`;

    const statusText = {
      pending: '等待解析',
      parsing: '正在解析...',
      ready: `已解析 ${resume.text.length} 字符`,
      error: `解析失败: ${resume.error || ''}`
    };

    item.innerHTML = `
      ${icon('document', 20)}
      <div class="file-info">
        <div class="file-name">${resume.name}</div>
        <div class="file-meta">${(resume.size / 1024).toFixed(1)} KB</div>
      </div>
      <span class="file-status status-${resume.status}">${statusText[resume.status] || resume.status}</span>
      <button class="file-remove" data-idx="${idx}">${icon('x', 14)}</button>
    `;
    container.appendChild(item);
  });

  $$('.file-remove').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx);
      state.resumes.splice(idx, 1);
      renderFileList();
      updateAnalysisButton();
    };
  });

  updateAnalysisButton();
}

function updateAnalysisButton() {
  const hasReady = state.resumes.some(r => r.status === 'ready' || r.status === 'demo');
  $('#startAnalysis').disabled = !hasReady;
}

// ========== 分析流程 ==========
async function runAnalysis() {
  goToStep(3);

  const steps = [
    { label: '解析 JD，提取评分维度...', duration: 800 },
    { label: '生成智能评分标准...', duration: 600 },
    { label: '读取并解析简历内容...', duration: 1000 },
    { label: '技能模糊匹配计算（近义词识别）...', duration: 800 },
    { label: '经验与学历评估...', duration: 600 },
    { label: '关键词相关性分析...', duration: 600 },
    { label: '综合评分计算...', duration: 700 },
    { label: '生成面试题目与排名...', duration: 800 }
  ];

  const stepsContainer = $('#analysisSteps');
  stepsContainer.innerHTML = '';
  const progressBar = $('#progressBar');

  for (let i = 0; i < steps.length; i++) {
    const stepEl = document.createElement('div');
    stepEl.className = 'analysis-step active';
    stepEl.innerHTML = `<span class="step-check">${icon('refresh', 14)}</span><span>${steps[i].label}</span>`;
    stepsContainer.appendChild(stepEl);

    if (i === 0) {
      state.jdAnalysis = analyzeJD(state.jdText);
    }
    if (i === 2) {
      for (const resume of state.resumes) {
        if (resume.status === 'pending' && resume.file) {
          try {
            resume.status = 'parsing';
            renderFileList();
            resume.text = await parsePDF(resume.file);
            resume.status = 'ready';
          } catch (e) {
            resume.status = 'error';
            resume.error = e.message;
          }
        }
      }
    }
    if (i === steps.length - 2) {
      const readyResumes = state.resumes.filter(r => r.status === 'ready' || r.status === 'demo');
      for (const resume of readyResumes) {
        resume.scores = scoreResume(resume.text, state.jdAnalysis);
      }
    }
    if (i === steps.length - 1) {
      const readyResumes = state.resumes.filter(r => r.status === 'ready' || r.status === 'demo');
      for (const resume of readyResumes) {
        resume.questions = generateInterviewQuestions(resume, state.jdAnalysis);
      }
      readyResumes.sort((a, b) => b.scores.total - a.scores.total);
      readyResumes.forEach((r, i) => r.rank = i + 1);
      state.rankedResumes = readyResumes;
    }

    await new Promise(r => setTimeout(r, steps[i].duration));

    stepEl.classList.remove('active');
    stepEl.classList.add('done');
    stepEl.querySelector('.step-check').innerHTML = icon('check', 14);

    progressBar.style.width = `${((i + 1) / steps.length) * 100}%`;
  }

  await new Promise(r => setTimeout(r, 500));
  renderResults();
  goToStep(4);
}

// ========== 结果渲染 ==========
function getScoreClass(score) {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 45) return 'medium';
  return 'low';
}

function getScoreBarClass(score) {
  if (score >= 80) return 'score-bar-excellent';
  if (score >= 65) return 'score-bar-good';
  if (score >= 45) return 'score-bar-medium';
  return 'score-bar-low';
}

function getScoreLabel(score) {
  if (score >= 80) return '强烈推荐';
  if (score >= 65) return '推荐面试';
  if (score >= 45) return '可考虑';
  return '不推荐';
}

function getRecommendationClass(rec) {
  return { strong: 'rec-strong', good: 'rec-good', medium: 'rec-medium', low: 'rec-low' }[rec] || 'rec-medium';
}

function getRecommendationText(rec) {
  return {
    strong: '强烈推荐 — 候选人高度匹配 JD 要求，建议优先安排面试',
    good: '推荐面试 — 候选人较好匹配 JD 要求，可进入面试流程',
    medium: '可考虑 — 候选人部分匹配 JD 要求，可根据实际情况评估',
    low: '不推荐 — 候选人与 JD 要求匹配度较低'
  }[rec] || '';
}

function getRecommendationIcon(rec) {
  return { strong: 'rocket', good: 'thumbsUp', medium: 'helpCircle', low: 'thumbsDown' }[rec] || 'helpCircle';
}

function renderInterviewQuestions(questions) {
  if (!questions || questions.length === 0) return '';
  const items = questions.map((q, i) => `
    <div class="interview-q-item">
      <div class="interview-q-header">
        <span class="interview-q-num">Q${i + 1}</span>
        <span class="interview-q-type">${icon(q.icon || 'messageSquare', 14)} ${q.label}</span>
      </div>
      <div class="interview-q-text">${q.question}</div>
      <div class="interview-q-reason">${icon('lightbulb', 14)} ${q.reason}</div>
    </div>
  `).join('');
  return `
    <div class="interview-q-section">
      <div class="interview-q-title">${icon('messageSquare', 18)} AI 推荐面试题目</div>
      ${items}
    </div>
  `;
}

// ========== 候选人入选理由生成（项目级深度分析）==========

// 项目段标记词 — 简历中提取"项目经历/实习经历/工作经历"段落的锚点
const PROJECT_SECTION_MARKERS = [
  '项目经历', '项目经验', 'projects', 'project experience',
  '实习经��', '实习经验', 'internship experience', 'work experience',
  '工作经历', '工作经验', 'professional experience', '经历',
  'experience'
];

// JD 业务领域关键词映射
const DOMAIN_KEYWORDS = {
  '电商': ['电商', '交易', '订单', '商品', '购物', '商城', 'ecommerce', 'e-commerce', 'shop', '淘宝', '京东', '拼多多', '亚马逊', 'amazon'],
  '金融': ['金融', '交易系统', '支付', '风控', '风险', '银行', '证券', '保险', 'finance', 'payment', 'risk', 'banking', 'trading', '清算'],
  '社交': ['社交', '社区', '朋友圈', '论坛', '聊天', '消息', 'social', 'community', 'chat', 'forum', 'bbs', '小红书'],
  '视频/直播': ['视频', '直播', '短视频', '点播', 'streaming', 'video', 'live', '抖音', '快手', 'bilibili', 'webrtc'],
  '出行': ['出行', '打车', '地图', '导航', 'ride', 'map', '滴滴', 'mobility', '物流', '配送'],
  '教育': ['教育', '学习', '课程', '在线教育', '培训', 'education', 'learning', '课程', '平台'],
  '医疗': ['医疗', '健康', '医生', '医院', 'health', 'medical', 'patient', '诊断'],
  '广告': ['广告', '投放', '营销', '推荐', 'ad', 'advertising', 'marketing', '推荐系统', 'recommender'],
  '云计算': ['云', '基础设施', 'infrastructure', 'cloud', 'aws', 'saas', 'paas', 'iaas', '容器', '服务网格'],
  'AI/大模型': ['大模型', 'LLM', 'AI', 'GPT', '人工智能', '机器学习', '深度学习', 'NLP', '计算机视觉', 'AIGC', 'Agent', '智能'],
  '企业服务': ['企业', 'B端', '后台', '管理', 'SaaS', 'CRM', 'ERP', 'OA', 'enterprise', 'admin', 'dashboard'],
  '游戏': ['游戏', 'game', '引擎', '渲染', 'unity', 'unreal', 'cocos'],
  '数据': ['数据平台', '数据仓库', 'BI', '数据分析', 'ETL', 'data', '数据中台', '大数据'],
  '信息安全': ['安全', 'security', '攻防', '渗透', '加密', '防火墙'],
};

/* 从简历文本中提取项目列表 */
function extractProjectsFromResume(text) {
  const projects = [];
  const lines = text.split('\n');

  // 先找到项目/经历相关 section
  let inProjectSection = false;
  let currentProject = null;
  let sectionLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const lineLower = line.toLowerCase();

    // 检测 section 开始
    const isMarker = PROJECT_SECTION_MARKERS.some(m => {
      const mlo = m.toLowerCase();
      return lineLower.includes(mlo) && line.length < 30;
    });
    if (isMarker) {
      if (currentProject) {
        finalizeProject(currentProject, sectionLines);
        projects.push(currentProject);
      }
      inProjectSection = true;
      currentProject = null;
      sectionLines = [];
      continue;
    }

    // 检测是否离开 section（遇到下一个大标题）
    if (inProjectSection && (lineLower.match(/^(教育背景|技能|语言|证书|获奖|联系方式|自我评价|个人信息|education|skills|certificate|language|contact|about|summary|个人简介)/) || (line.length < 20 && !line.startsWith('-') && !line.startsWith('·') && !line.startsWith('•') && !line.match(/^\d/)))) {
      if (currentProject) {
        finalizeProject(currentProject, sectionLines);
        projects.push(currentProject);
      }
      inProjectSection = false;
      currentProject = null;
      sectionLines = [];
      continue;
    }

    if (inProjectSection) {
      // 检测新项目开始：以 -/·/• 开头且含公司名/项目名
      const isProjectStart = (line.startsWith('-') || line.startsWith('·') || line.startsWith('•') || line.match(/^\d+\./) || line.startsWith('●')) &&
        line.length > 10 &&
        (line.includes('公司') || line.includes('科技') || line.includes('项目') || line.includes('平台') || line.includes('系统') ||
         line.includes('实习') || line.includes('intern') || line.includes('project') || line.includes('公司'));

      if (isProjectStart) {
        if (currentProject) {
          finalizeProject(currentProject, sectionLines);
          projects.push(currentProject);
        }
        currentProject = { title: line.replace(/^[-·•●\d]+[.、\s]*/, ''), lines: [], techStack: [], results: [], domain: '', credibility: 0, specScore: 0 };
        sectionLines = [line];
      } else if (currentProject) {
        currentProject.lines.push(line);
        sectionLines.push(line);
      }
    }
  }

  if (currentProject) {
    finalizeProject(currentProject, sectionLines);
    projects.push(currentProject);
  }

  return projects;
}

function finalizeProject(project, allLines) {
  const fullText = allLines.join(' ').toLowerCase();

  // 提取技术栈
  for (const [cat, data] of Object.entries(SKILLS_DB)) {
    for (const skill of data.skills) {
      if (fullText.includes(skill.toLowerCase()) && !project.techStack.includes(skill)) {
        project.techStack.push(skill);
      }
    }
  }

  // 提取量化结果
  const quantPatterns = [
    /(\d+[%％])/g,
    /(\d+[\s]*[万kK]\+?\s*(用户|月活|DAU|MAU))/gi,
    /(\d+[\s]*[倍xX]\s*(提升|增长|降低|减少))/gi,
    /(提升|增长|降低|减少|优化|缩短)[\s]*(\d+[%％])/gi,
    /(QPS|TPS|延迟|latency|响应时间)[\s]*[：:]*\s*(\d+)/gi,
  ];
  for (const p of quantPatterns) {
    const matches = fullText.match(p);
    if (matches) {
      for (const m of matches) {
        if (!project.results.includes(m)) project.results.push(m);
      }
    }
  }

  // 判断业务领域
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const kw of keywords) {
      if (fullText.includes(kw.toLowerCase())) {
        project.domain = domain;
        break;
      }
    }
    if (project.domain) break;
  }

  // 可信度评分：有量化结果 +15，有具体技术栈 +10，描述超过 3 行 +5
  let cred = 0;
  cred += Math.min(project.results.length * 15, 30);
  cred += Math.min(project.techStack.length * 5, 20);
  cred += allLines.length >= 3 ? 10 : 0;
  cred += project.title.length > 8 ? 5 : 0;
  project.credibility = Math.min(100, cred);
  project.specScore = Math.min(100, cred);
}

/* 从 JD 中提取业务领域 */
function extractJDDomain(jdText) {
  const jdLower = jdText.toLowerCase();
  const domains = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let hits = 0;
    for (const kw of keywords) {
      if (jdLower.includes(kw.toLowerCase())) hits++;
    }
    if (hits >= 1) domains.push({ domain, hits });
  }
  domains.sort((a, b) => b.hits - a.hits);
  return domains.slice(0, 3).map(d => d.domain);
}

/* 分析单个项目与 JD 的匹配度 */
function analyzeProjectMatch(project, jdAnalysis) {
  const result = {
    techHits: [],
    techMiss: [],
    domainMatch: false,
    isSuspicious: false,
    suspicionReasons: [],
    strength: 'weak'  // strong / moderate / weak
  };

  // 技术匹配
  const jdSkills = jdAnalysis.skills.map(s => s.skill);
  const jdSkillLower = jdSkills.map(s => s.toLowerCase());
  for (const tech of project.techStack) {
    if (jdSkillLower.some(s => tech.toLowerCase().includes(s) || s.includes(tech.toLowerCase()))) {
      result.techHits.push(tech);
    }
  }
  const missingJdSkills = jdSkills.filter(s => !project.techStack.some(t => t.toLowerCase() === s.toLowerCase()));
  result.techMiss = missingJdSkills;

  // 领域匹配
  const jdDomains = extractJDDomain(jdAnalysis.rawText);
  result.domainMatch = jdDomains.includes(project.domain) || !project.domain;

  // 可疑度判断
  if (project.techStack.length === 0) {
    result.isSuspicious = true;
    result.suspicionReasons.push('未体现任何具体技术栈');
  }
  if (project.results.length === 0 && project.lines.length < 3) {
    result.isSuspicious = true;
    result.suspicionReasons.push('项目描述过于简略，无量化成果');
  }
  if (project.title.length < 6) {
    result.isSuspicious = true;
    result.suspicionReasons.push('项目名称过于简短，疑似随意填写');
  }
  // 检测模糊描述
  const vaguePhrases = ['负责开发', '参与开发', '协助完成', '配合团队', '完成日常', '其他工作'];
  const hasConcrete = project.lines.some(l => !vaguePhrases.some(vp => l.includes(vp)) && l.length > 15);
  if (!hasConcrete && project.lines.length < 3) {
    result.isSuspicious = true;
    result.suspicionReasons.push('描述模糊，缺乏具体工作内容');
  }

  // 强度评级
  const techHitRatio = jdSkills.length > 0 ? result.techHits.length / jdSkills.length : 0;
  if (techHitRatio >= 0.5 && result.domainMatch && project.results.length >= 1 && !result.isSuspicious) {
    result.strength = 'strong';
  } else if (techHitRatio >= 0.3 && project.results.length >= 1 && !result.isSuspicious) {
    result.strength = 'moderate';
  } else {
    result.strength = 'weak';
  }

  return result;
}

/* 生成详细的、项目级的入选理由 */
function generateSelectionReason(resume, rank, total) {
  // 先提取简历中的项目
  const projects = extractProjectsFromResume(resume.text);
  const jdAnalysis = state.jdAnalysis;

  if (!jdAnalysis) {
    // fallback: 无 JD 时用原始逻辑
    return generateBasicReason(resume, rank, total);
  }

  const jdDomains = extractJDDomain(jdAnalysis.rawText);
  const jdSkills = jdAnalysis.skills.map(s => s.skill);
  const s = resume.scores;

  const sections = [];

  // ====== 1. 排名定位 ======
  if (rank === 1) {
    sections.push({ tag: 'positive', text: `排名第1 · 综合评分 ${s.total} 分，在 ${total} 位候选人中表现最优` });
  } else if (rank <= 3) {
    sections.push({ tag: 'neutral', text: `排名前${rank} · 综合评分 ${s.total} 分` });
  } else {
    sections.push({ tag: 'neutral', text: `排名${rank} · 综合评分 ${s.total} 分` });
  }

  // ====== 2. 项目级别���匹配分析 ======
  if (projects.length > 0) {
    const projectAnalyses = projects.map(p => ({
      project: p,
      analysis: analyzeProjectMatch(p, jdAnalysis)
    }));

    const strongProjects = projectAnalyses.filter(pa => pa.analysis.strength === 'strong');
    const moderateProjects = projectAnalyses.filter(pa => pa.analysis.strength === 'moderate');
    const suspiciousProjects = projectAnalyses.filter(pa => pa.analysis.isSuspicious);

    // 2a. 找到与 JD 高度匹配的项目，点名表扬
    const allRelevant = [...strongProjects, ...moderateProjects];
    if (allRelevant.length > 0) {
      const bestProject = allRelevant[0];
      const techs = bestProject.analysis.techHits;
      const techNote = techs.length > 0
        ? `（技术栈 ${techs.slice(0, 3).join('/')}${techs.length > 3 ? '等' : ''} 与 JD 要求契合）`
        : '';
      if (bestProject.analysis.strength === 'strong') {
        sections.push({
          tag: 'positive',
          text: `项目「${bestProject.project.title}」${bestProject.project.results.length > 0 ? `有量化成果（${bestProject.project.results.slice(0, 2).join('、')}）` : ''}，业务方向与 JD ${jdDomains.length > 0 ? `（${jdDomains[0]}领域）` : ''}高度相关${techNote}`
        });
      } else {
        sections.push({
          tag: 'neutral',
          text: `项目「${bestProject.project.title}」${bestProject.project.results.length > 0 ? `有 ${bestProject.project.results.length} 项量化结果` : '缺少量化数据'}，${techNote}`
        });
      }

      // 如果还有更多匹配项目，简要提及
      if (allRelevant.length > 1) {
        const otherNames = allRelevant.slice(1, 3).map(pa => `「${pa.project.title}」`).join('、');
        sections.push({
          tag: 'neutral',
          text: `另 ${allRelevant.length - 1} 个项目 ${otherNames} 也与 JD 有一定关联`
        });
      }
    }

    // 2b. 标记可疑/乱写的项目
    if (suspiciousProjects.length > 0) {
      const suspicionDetails = suspiciousProjects.map(sp => {
        const reasons = sp.analysis.suspicionReasons.slice(0, 2).join('；');
        return `「${sp.project.title}」(${reasons})`;
      }).join('，');
      sections.push({
        tag: 'negative',
        text: `⚠️ ${suspiciousProjects.length} 个项目存疑需面试验证：${suspicionDetails}`
      });
    }
  } else {
    // 没有项目
    sections.push({
      tag: 'negative',
      text: '简历中未提取到明确的项目/实习经历，无法验证实际能力'
    });
  }

  // ====== 3. JD 技能覆盖情况 ======
  const matchedSkills = s.skillMatch.matched;
  const missingSkills = s.skillMatch.missing;
  const totalSkills = matchedSkills.length + missingSkills.length;

  if (totalSkills > 0) {
    const matchedByProject = matchedSkills.filter(ms =>
      projects.some(p => p.techStack.some(t => t.toLowerCase() === ms.toLowerCase()))
    );
    const matchedNotInProjects = matchedSkills.filter(ms =>
      projects.length > 0 && !projects.some(p => p.techStack.some(t => t.toLowerCase() === ms.toLowerCase()))
    );

    if (missingSkills.length === 0 && matchedByProject.length > 0) {
      sections.push({
        tag: 'positive',
        text: `JD 全部 ${totalSkills} 项技能在具体项目中得到体现（${matchedByProject.slice(0, 4).join('、')}${matchedByProject.length > 4 ? '等' : ''}）`
      });
    } else if (missingSkills.length > 0) {
      const verified = matchedByProject.length > 0
        ? `（其中 ${matchedByProject.length} 项在项目中有实际应用痕迹）`
        : '';
      sections.push({
        tag: 'negative',
        text: `技能缺口：缺失 ${missingSkills.join('、')} 等 ${missingSkills.length} 项 JD 关键技能${verified}`
      });
    }
  }

  // ====== 4. 经验与学历 ======
  if (s.experience.actual > 0 && s.experience.required > 0) {
    if (s.experience.actual >= s.experience.required) {
      sections.push({ tag: 'positive', text: `${s.experience.actual} 年经验 → 满足 JD ${s.experience.required} 年要求` });
    } else {
      sections.push({ tag: 'negative', text: `${s.experience.actual} 年经验 → 不满足 JD ${s.experience.required} 年要求` });
    }
  }

  if (s.education.required && s.education.actual !== '未识别') {
    if (s.education.score >= 90) {
      sections.push({ tag: 'positive', text: `${s.education.actual} → 满足 ${s.education.required} 要求` });
    } else {
      sections.push({ tag: 'negative', text: `${s.education.actual} → 低于 ${s.education.required} 要求` });
    }
  }

  // ====== 5. 综合评价 ======
  const hasStrongProject = projects.some(p => analyzeProjectMatch(p, jdAnalysis).strength === 'strong');
  const suspiciousCount = projects.filter(p => analyzeProjectMatch(p, jdAnalysis).isSuspicious).length;
  const projectRatio = projects.length > 0 ? suspiciousCount / projects.length : 0;

  if (s.total >= 80 && hasStrongProject) {
    sections.push({ tag: 'positive', text: `项目经历真实可信，与 JD 高度匹配，强烈推荐进入面试` });
  } else if (s.total >= 65 && hasStrongProject) {
    sections.push({ tag: 'neutral', text: `有可验证的项目经验，建议安排面试深入考察` });
  } else if (s.total >= 45 && projectRatio <= 0.5) {
    sections.push({ tag: 'neutral', text: `项目经历部分匹配，可酌情考虑面试` });
  } else if (projectRatio > 0.5 && projects.length > 0) {
    sections.push({ tag: 'negative', text: `${suspiciousCount}/${projects.length} 个项目存疑，建议优先面试其他候选人` });
  } else {
    sections.push({ tag: 'negative', text: `匹配度较低，与 JD 核心要求差距较大，暂不推荐` });
  }

  // 渲染为 HTML
  return sections.map(sec =>
    `<div class="reason-line"><span class="reason-tag ${sec.tag}">${sec.tag === 'positive' ? '✓ 推荐' : sec.tag === 'negative' ? '✗ 存疑' : '○ 一般'}</span>${sec.text}</div>`
  ).join('');
}

/* 基础入选理由（无 JD 时降级使用） */
function generateBasicReason(resume, rank, total) {
  const s = resume.scores;
  const reasons = [];

  if (rank === 1) {
    reasons.push(`<span class="reason-tag positive">排名第1</span>综合评分 <strong>${s.total}</strong> 分，在 ${total} 位候选人中表现最优`);
  } else if (rank <= 3) {
    reasons.push(`<span class="reason-tag neutral">排名前${rank}</span>综合评分 <strong>${s.total}</strong> 分`);
  } else {
    reasons.push(`<span class="reason-tag neutral">排名${rank}</span>综合评分 <strong>${s.total}</strong> 分`);
  }

  const matchedCount = s.skillMatch.matched.length;
  const missingCount = s.skillMatch.missing.length;
  if (matchedCount + missingCount > 0) {
    if (missingCount === 0) {
      reasons.push(`<span class="reason-tag positive">技能全匹配</span>各项技能均命中`);
    } else {
      reasons.push(`匹配 ${matchedCount}/${matchedCount + missingCount} 项技能，缺失 ${missingCount} 项`);
    }
  }
  reasons.push(`经验 ${s.experience.actual} 年 · ${s.education.actual || '学历未识别'}`);

  return reasons.join('；') + '。';
}

// ========== 简历查看弹窗 ==========
function showResumeModal(resume, rank) {
  const overlay = $('#resumeModalOverlay');
  const rankEl = $('#resumeModalRank');
  const nameEl = $('#resumeModalName');
  const scoreEl = $('#resumeModalScore');
  const bodyEl = $('#resumeModalBody');

  const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
  rankEl.className = `resume-modal-rank ${rankClass}`;
  rankEl.textContent = rank;

  // 从文件名提取人名
  const displayName = resume.name.replace(/\.pdf$/i, '').replace(/[_\-]/g, ' ');
  nameEl.textContent = displayName;

  const scoreClass = getScoreClass(resume.scores.total);
  const scoreLabel = getScoreLabel(resume.scores.total);
  scoreEl.innerHTML = `综合评分 <strong style="color:var(--${scoreClass === 'excellent' ? 'success' : scoreClass === 'good' ? 'primary' : scoreClass === 'medium' ? 'warning' : 'danger'})">${resume.scores.total}</strong> · ${scoreLabel} · ${resume.scores.experience.actual > 0 ? resume.scores.experience.actual + '年经验' : ''}`;

  bodyEl.innerHTML = `
    <div class="resume-modal-section-label">候选人简历原文</div>
    <div class="resume-modal-text">${escapeHtml(resume.text)}</div>
  `;

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeResumeModal() {
  $('#resumeModalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderResults() {
  const resumes = state.rankedResumes || [];
  const analysis = state.jdAnalysis;

  $('#resultsSummary').textContent =
    `共分析 ${resumes.length} 位候选人 · 评分维度 ${Object.keys(analysis.criteria).length} 项 · 综合匹配分已生成`;

  // 排名图表
  const chartContainer = $('#rankingChart');
  chartContainer.innerHTML = '';
  resumes.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'rank-bar-row';
    row.setAttribute('data-rank', i + 1);
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    const barClass = getScoreBarClass(r.scores.total);
    const reasonHtml = generateSelectionReason(r, i + 1, resumes.length);
    const displayName = r.name.replace(/\.pdf$/i, '').replace(/[_\-]/g, ' ');
    row.innerHTML = `
      <div class="rank-badge ${rankClass}">${i + 1}</div>
      <div class="rank-info">
        <div class="rank-name">${displayName}</div>
        <div class="rank-bar-track">
          <div class="rank-bar-fill ${barClass}" style="width: ${Math.max(r.scores.total, 5)}%">${r.scores.total}</div>
        </div>
        <div class="rank-reason">${reasonHtml}</div>
      </div>
      <span class="rank-click-hint">${icon('fileText', 14)} 查看简历</span>
    `;
    row.addEventListener('click', () => showResumeModal(r, i + 1));
    chartContainer.appendChild(row);
  });

  // 评分标准
  const criteriaGrid = $('#criteriaGrid');
  criteriaGrid.innerHTML = '';
  const criteriaItems = [
    { label: '技能匹配', value: analysis.criteria.skills.items.length + ' 项技能', weight: analysis.criteria.skills.weight + '%' },
    { label: '工作经验', value: analysis.requiredYears > 0 ? analysis.requiredYears + '+ 年' : '未明确', weight: analysis.criteria.experience.weight + '%' },
    { label: '学历要求', value: analysis.eduRequirement ? analysis.eduRequirement.name : '不限', weight: analysis.criteria.education.weight + '%' },
    { label: '关键词相关性', value: 'TF 频率匹配', weight: analysis.criteria.keywords.weight + '%' }
  ];
  criteriaItems.forEach(c => {
    const item = document.createElement('div');
    item.className = 'criteria-item';
    item.innerHTML = `
      <div class="criteria-label">${c.label}</div>
      <div class="criteria-value">${c.value}</div>
      <div class="criteria-weight">权重 ${c.weight}</div>
    `;
    criteriaGrid.appendChild(item);
  });

  // 候选人详细卡片
  const cardsContainer = $('#candidateCards');
  cardsContainer.innerHTML = '';
  resumes.forEach((r, i) => {
    const card = document.createElement('div');
    const topClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
    card.className = `candidate-card ${topClass}`;
    const scoreClass = getScoreClass(r.scores.total);
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    const recClass = getRecommendationClass(r.scores.recommendation);
    const recText = getRecommendationText(r.scores.recommendation);
    const recIconName = getRecommendationIcon(r.scores.recommendation);

    const matchedTags = r.scores.skillMatch.matched.map(s =>
      `<span class="match-tag matched">${icon('check', 12)} ${s}</span>`
    ).join('');
    const missingTags = r.scores.skillMatch.missing.map(s =>
      `<span class="match-tag missing">${icon('x', 12)} ${s}</span>`
    ).join('');

    const breakdownItems = [
      { label: '技能匹配', score: r.scores.skillMatch.score, weight: r.scores.skillMatch.weight },
      { label: '工作经验', score: r.scores.experience.score, weight: r.scores.experience.weight },
      { label: '学历匹配', score: r.scores.education.score, weight: r.scores.education.weight },
      { label: '关键词相关性', score: r.scores.keywordDensity.score, weight: r.scores.keywordDensity.weight }
    ];

    const breakdownHtml = breakdownItems.map(b => {
      const bClass = getScoreBarClass(b.score);
      return `
        <div class="breakdown-item">
          <div class="breakdown-header">
            <span class="breakdown-label">${b.label}</span>
            <span class="breakdown-score ${getScoreClass(b.score)}">${b.score}</span>
          </div>
          <div class="breakdown-bar">
            <div class="breakdown-fill ${bClass}" style="width: ${b.score}%"></div>
          </div>
          <div style="font-size:11px;color:var(--gray-400);margin-top:4px;">权重 ${b.weight}%</div>
        </div>
      `;
    }).join('');

    const expDetail = r.scores.experience.actual > 0
      ? `${r.scores.experience.actual}年经验` : '未识别';
    const eduDetail = r.scores.education.actual !== '未识别'
      ? r.scores.education.actual : '未识别';

    const displayName = r.name.replace(/\.pdf$/i, '').replace(/[_\-]/g, ' ');
    card.innerHTML = `
      <div class="candidate-header">
        <div class="candidate-rank ${rankClass}" style="cursor:pointer" title="点击查看简历">${i + 1}</div>
        <div class="candidate-info">
          <div class="candidate-name" style="cursor:pointer" title="点击查看简历">${displayName}</div>
          <div class="candidate-role">${expDetail} · ${eduDetail}</div>
        </div>
        <div class="candidate-score-display">
          <div class="score-value ${scoreClass}">${r.scores.total}</div>
          <div class="score-label">${getScoreLabel(r.scores.total)}</div>
        </div>
      </div>
      <div class="score-breakdown">${breakdownHtml}</div>
      <div class="match-tags-section">
        ${matchedTags ? `
        <div class="match-tags-group">
          <div class="match-tags-title matched-title">${icon('check', 14)} 匹配技能 (${r.scores.skillMatch.matched.length})</div>
          <div class="match-tags">${matchedTags}</div>
        </div>` : ''}
        ${missingTags ? `
        <div class="match-tags-group">
          <div class="match-tags-title missing-title">${icon('x', 14)} 缺失技能 (${r.scores.skillMatch.missing.length})</div>
          <div class="match-tags">${missingTags}</div>
        </div>` : ''}
      </div>
      ${r.questions ? renderInterviewQuestions(r.questions) : ''}
      <div class="recommendation ${recClass}">${icon(recIconName, 18)} ${recText}</div>
      <button class="btn btn-ghost" style="margin-top:16px;width:100%;justify-content:center" data-resume-idx="${i}">
        ${icon('fileText', 16)} 查看完整简历
      </button>
    `;
    // 点击排名徽章/姓名/按钮查看简历
    const rankEl = card.querySelector('.candidate-rank');
    const nameEl = card.querySelector('.candidate-name');
    const resumeBtn = card.querySelector('[data-resume-idx]');
    const openResume = () => showResumeModal(r, i + 1);
    rankEl.addEventListener('click', openResume);
    nameEl.addEventListener('click', openResume);
    if (resumeBtn) resumeBtn.addEventListener('click', openResume);
    cardsContainer.appendChild(card);
  });
}

// ========== 导出报告 (完全自包含 HTML) ==========
function exportReport() {
  const resumes = state.rankedResumes || [];
  const analysis = state.jdAnalysis;
  const date = new Date().toLocaleString('zh-CN');

  const reportHtml = generateSelfContainedReport(resumes, analysis, date);

  const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AI招聘评分报告_${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// 生成完全自包含的报告 HTML（所有 CSS 内联，无外部依赖）
function generateSelfContainedReport(resumes, analysis, date) {
  const svgIcon = (paths, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle">${paths}</svg>`;

  const icons = {
    robot: svgIcon('<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/><path d="M9 11a3 3 0 0 1 6 0"/>', 20),
    clipboard: svgIcon('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>', 18),
    target: svgIcon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>', 18),
    chartBar: svgIcon('<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>', 18),
    user: svgIcon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', 18),
    check: svgIcon('<polyline points="20 6 9 17 4 12"/>', 14),
    x: svgIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 14),
    messageSquare: svgIcon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', 16),
    lightbulb: svgIcon('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>', 14),
    crosshair: svgIcon('<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>', 14),
    search: svgIcon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', 14),
    layers: svgIcon('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>', 14),
    rocket: svgIcon('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>', 16),
    thumbsUp: svgIcon('<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>', 16),
    helpCircle: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 16),
    thumbsDown: svgIcon('<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm0-13H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>', 16)
  };

  const recIcons = { strong: icons.rocket, good: icons.thumbsUp, medium: icons.helpCircle, low: icons.thumbsDown };

  let body = '';

  // 排名表格
  let rankingRows = resumes.map((r, i) => {
    const sc = r.scores.total >= 65 ? '#059669' : r.scores.total >= 45 ? '#d97706' : '#dc2626';
    return `<tr>
      <td style="text-align:center;font-weight:700">${i + 1}</td>
      <td style="font-weight:600">${r.name}</td>
      <td style="text-align:center;font-size:20px;font-weight:800;color:${sc}">${r.scores.total}</td>
      <td style="text-align:center">${r.scores.skillMatch.score}</td>
      <td style="text-align:center">${r.scores.experience.score}</td>
      <td style="text-align:center">${r.scores.education.score}</td>
      <td style="text-align:center">${r.scores.keywordDensity.score}</td>
      <td>${getScoreLabel(r.scores.total)}</td>
    </tr>`;
  }).join('\n');

  // 候选人详情
  let candidateDetails = resumes.map((r, i) => {
    const recIcon = recIcons[r.scores.recommendation] || icons.helpCircle;
    const matchedTags = r.scores.skillMatch.matched.map(s =>
      `<span class="rpt-tag rpt-tag-matched">${icons.check} ${s}</span>`
    ).join('') || '<span style="color:#9ca3af">无</span>';
    const missingTags = r.scores.skillMatch.missing.map(s =>
      `<span class="rpt-tag rpt-tag-missing">${icons.x} ${s}</span>`
    ).join('') || '<span style="color:#9ca3af">无</span>';

    const breakdownBars = [
      { label: '技能匹配', score: r.scores.skillMatch.score, weight: r.scores.skillMatch.weight },
      { label: '工作经验', score: r.scores.experience.score, weight: r.scores.experience.weight },
      { label: '学历匹配', score: r.scores.education.score, weight: r.scores.education.weight },
      { label: '关键词相关性', score: r.scores.keywordDensity.score, weight: r.scores.keywordDensity.weight }
    ].map(b => {
      const bc = b.score >= 80 ? '#10b981' : b.score >= 65 ? '#6366f1' : b.score >= 45 ? '#f59e0b' : '#ef4444';
      return `<div class="rpt-breakdown-item">
        <div class="rpt-breakdown-header"><span>${b.label}</span><span style="font-weight:700;color:${bc}">${b.score}</span></div>
        <div class="rpt-breakdown-bar"><div style="width:${b.score}%;background:${bc};height:100%;border-radius:3px"></div></div>
        <div style="font-size:11px;color:#9ca3af;margin-top:3px">权重 ${b.weight}%</div>
      </div>`;
    }).join('');

    const questionsHtml = r.questions ? r.questions.map((q, qi) => {
      const qIcon = q.icon === 'crosshair' ? icons.crosshair : q.icon === 'search' ? icons.search : q.icon === 'layers' ? icons.layers : icons.messageSquare;
      return `<div class="rpt-q-item">
        <div class="rpt-q-header">
          <span class="rpt-q-num">Q${qi + 1}</span>
          <span class="rpt-q-type">${qIcon} ${q.label}</span>
        </div>
        <div class="rpt-q-text">${q.question}</div>
        <div class="rpt-q-reason">${icons.lightbulb} ${q.reason}</div>
      </div>`;
    }).join('') : '<p>未生成面试题目</p>';

    return `<div class="rpt-candidate-card">
      <div class="rpt-candidate-header">
        <div class="rpt-rank-badge rank-${i < 3 ? i + 1 : 'other'}">${i + 1}</div>
        <div class="rpt-candidate-info">
          <div class="rpt-candidate-name">${r.name}</div>
          <div class="rpt-candidate-role">${r.scores.experience.actual > 0 ? r.scores.experience.actual + '年经验' : '经验未识别'} · ${r.scores.education.actual || '学历未识别'}</div>
        </div>
        <div class="rpt-score-display">
          <div class="rpt-score-value" style="color:${r.scores.total >= 80 ? '#10b981' : r.scores.total >= 65 ? '#6366f1' : r.scores.total >= 45 ? '#f59e0b' : '#ef4444'}">${r.scores.total}</div>
          <div class="rpt-score-label">${getScoreLabel(r.scores.total)}</div>
        </div>
      </div>
      <div class="rpt-breakdown-grid">${breakdownBars}</div>
      <div class="rpt-tags-section">
        <div class="rpt-tags-group">
          <div class="rpt-tags-title" style="color:#10b981">${icons.check} 匹配技能</div>
          <div class="rpt-tags">${matchedTags}</div>
        </div>
        <div class="rpt-tags-group">
          <div class="rpt-tags-title" style="color:#ef4444">${icons.x} 缺失技能</div>
          <div class="rpt-tags">${missingTags}</div>
        </div>
      </div>
      <div class="rpt-interview-section">
        <div class="rpt-interview-title">${icons.messageSquare} AI 推荐面试题目</div>
        ${questionsHtml}
      </div>
      <div class="rpt-recommendation rpt-rec-${r.scores.recommendation}">${recIcon} ${getRecommendationText(r.scores.recommendation)}</div>
    </div>`;
  }).join('\n');

  const css = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:#f9fafb;color:#1f2937;line-height:1.6;padding:32px 16px}
.rpt-container{max-width:900px;margin:0 auto}
.rpt-header{background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;border-radius:16px;padding:32px;margin-bottom:24px;box-shadow:0 10px 25px -5px rgba(79,70,229,0.3)}
.rpt-header h1{font-size:24px;font-weight:800;display:flex;align-items:center;gap:10px}
.rpt-header .rpt-meta{margin-top:12px;font-size:13px;opacity:.85;display:flex;gap:20px;flex-wrap:wrap}
.rpt-card{background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.08)}
.rpt-section-title{font-size:18px;font-weight:700;color:#111827;margin-bottom:16px;display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:2px solid #e5e7eb}
.rpt-jd-text{background:#f9fafb;border-radius:12px;padding:16px;font-size:13px;line-height:1.8;white-space:pre-wrap;color:#4b5563;border:1px solid #e5e7eb;max-height:300px;overflow-y:auto}
.rpt-criteria-table{width:100%;border-collapse:collapse;font-size:14px}
.rpt-criteria-table th{background:#f3f4f6;padding:10px 14px;text-align:left;font-weight:600;color:#374151;border:1px solid #e5e7eb}
.rpt-criteria-table td{padding:10px 14px;border:1px solid #e5e7eb;color:#4b5563}
.rpt-criteria-table td:first-child{font-weight:600}
.rpt-ranking-table{width:100%;border-collapse:collapse;font-size:14px}
.rpt-ranking-table th{background:#4f46e5;color:#fff;padding:10px 14px;text-align:center;font-weight:600}
.rpt-ranking-table th:first-child,.rpt-ranking-table th:nth-child(2){text-align:left}
.rpt-ranking-table td{padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center}
.rpt-ranking-table td:nth-child(2){text-align:left}
.rpt-ranking-table tr:hover{background:#f9fafb}
.rpt-candidate-card{background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.08);border:2px solid transparent}
.rpt-candidate-card:nth-child(1){border-color:#fbbf24}
.rpt-candidate-card:nth-child(2){border-color:#d1d5db}
.rpt-candidate-card:nth-child(3){border-color:#d97706}
.rpt-candidate-header{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.rpt-rank-badge{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;font-size:16px;font-weight:700;color:#fff;flex-shrink:0}
.rank-1{background:linear-gradient(135deg,#fbbf24,#f59e0b);box-shadow:0 2px 8px rgba(245,158,11,.4)}
.rank-2{background:linear-gradient(135deg,#d1d5db,#9ca3af)}
.rank-3{background:linear-gradient(135deg,#d97706,#b45309)}
.rank-other{background:#e5e7eb;color:#6b7280}
.rpt-candidate-info{flex:1}
.rpt-candidate-name{font-size:17px;font-weight:700;color:#111827}
.rpt-candidate-role{font-size:12px;color:#9ca3af;margin-top:2px}
.rpt-score-display{text-align:right}
.rpt-score-value{font-size:32px;font-weight:800;line-height:1}
.rpt-score-label{font-size:11px;color:#9ca3af;margin-top:2px}
.rpt-breakdown-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px}
.rpt-breakdown-item{padding:12px;background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb}
.rpt-breakdown-header{display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:#4b5563;margin-bottom:6px}
.rpt-breakdown-bar{height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden}
.rpt-tags-section{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px}
.rpt-tags-group{flex:1;min-width:180px}
.rpt-tags-title{font-size:12px;font-weight:600;margin-bottom:6px}
.rpt-tags{display:flex;flex-wrap:wrap;gap:5px}
.rpt-tag{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600}
.rpt-tag-matched{background:#ecfdf5;color:#059669;border:1px solid #a7f3d0}
.rpt-tag-missing{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.rpt-interview-section{margin-top:16px;padding:18px;background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border-radius:12px;border:1px solid #a7f3d0}
.rpt-interview-title{font-size:14px;font-weight:700;color:#065f46;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.rpt-q-item{padding:12px 14px;background:#fff;border-radius:8px;margin-bottom:8px;border:1px solid #d1fae5}
.rpt-q-header{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.rpt-q-num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#4f46e5;color:#fff;font-size:11px;font-weight:700}
.rpt-q-type{font-size:12px;font-weight:600;color:#4338ca;background:#eef2ff;padding:2px 8px;border-radius:4px;display:inline-flex;align-items:center;gap:3px}
.rpt-q-text{font-size:13px;color:#1f2937;line-height:1.7;padding-left:30px}
.rpt-q-reason{font-size:11px;color:#9ca3af;padding-left:30px;margin-top:3px}
.rpt-recommendation{padding:10px 14px;border-radius:10px;font-size:13px;margin-top:12px;display:flex;align-items:center;gap:8px}
.rpt-rec-strong{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
.rpt-rec-good{background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe}
.rpt-rec-medium{background:#fffbeb;color:#92400e;border:1px solid #fde68a}
.rpt-rec-low{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
.rpt-footer{text-align:center;padding:24px;color:#9ca3af;font-size:12px}
@media(max-width:640px){.rpt-candidate-header{flex-direction:column;align-items:flex-start}.rpt-score-display{text-align:left}.rpt-breakdown-grid{grid-template-columns:1fr}.rpt-tags-section{flex-direction:column}}
`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>AI 招聘智能体 — 评分报告</title>
<style>${css}</style>
</head>
<body>
<div class="rpt-container">
  <div class="rpt-header">
    <h1>${icons.robot} AI 招聘智能体 — 评分报告</h1>
    <div class="rpt-meta">
      <span>生成时间: ${date}</span>
      <span>候选人数量: ${resumes.length}</span>
      <span>评分维度: 4 项</span>
    </div>
  </div>

  <div class="rpt-card">
    <div class="rpt-section-title">${icons.clipboard} 职位描述 (JD)</div>
    <div class="rpt-jd-text">${analysis.rawText.replace(/</g, '&lt;')}</div>
  </div>

  <div class="rpt-card">
    <div class="rpt-section-title">${icons.target} AI 生成的评分标准</div>
    <table class="rpt-criteria-table">
      <tr><th>维度</th><th>详情</th><th>权重</th></tr>
      <tr><td>技能匹配</td><td>${analysis.criteria.skills.items.join(', ') || '无'}</td><td>${analysis.criteria.skills.weight}%</td></tr>
      <tr><td>工作经验</td><td>${analysis.requiredYears > 0 ? analysis.requiredYears + '+ 年' : '不限'}</td><td>${analysis.criteria.experience.weight}%</td></tr>
      <tr><td>学历要求</td><td>${analysis.eduRequirement ? analysis.eduRequirement.name : '不限'}</td><td>${analysis.criteria.education.weight}%</td></tr>
      <tr><td>关键词相关性</td><td>TF 频率匹配</td><td>${analysis.criteria.keywords.weight}%</td></tr>
    </table>
  </div>

  <div class="rpt-card">
    <div class="rpt-section-title">${icons.chartBar} 候选人排名</div>
    <table class="rpt-ranking-table">
      <tr><th>排名</th><th>候选人</th><th>综合分</th><th>技能</th><th>经验</th><th>学历</th><th>关键词</th><th>推荐</th></tr>
      ${rankingRows}
    </table>
  </div>

  <div class="rpt-section-title" style="margin-top:32px">${icons.user} 候选人详细评分</div>
  ${candidateDetails}

  <div class="rpt-footer">
    本报告由 AI 招聘智能体自动生成 · 技能匹配采用近义词模糊匹配算法<br>
    仅供参考，最终录用决策请结合面试综合评估
  </div>
</div>
</body>
</html>`;
}

// ========== 示例数据 ==========
const DEMO_JD = `岗位名称：高级 Python 后端工程师

部门：技术中心 - 平台架构组

岗位职责：
1. 负责公司核心业务系统的后端架构设计与开发，使用 Python + Django 框架
2. 参与微服务架构的拆分与设计，使用 Docker + Kubernetes 部署
3. 优化 MySQL 数据库性能，设计 Redis 缓存策略
4. 搭建 CI/CD 流水线，使用 Jenkins 自动化部署
5. 参与团队 Code Review，指导初中级开发工程师
6. 与产品、前端团队协作，保障项目按时交付

任职要求：
1. 本科及以上学历，计算机科学、软件工程或相关专业
2. 5年以上 Python 开发经验，熟悉 Django 或 Flask 框架
3. 熟练使用 MySQL、Redis，了解 PostgreSQL 更佳
4. 熟悉 Docker、Kubernetes，有微服务架构实践经验
5. 了解 Elasticsearch、Kafka 等中间件
6. 熟悉 Linux 操作系统，掌握 Nginx 配置
7. 具备良好的沟通能力和团队协作精神，有项目管理经验优先
8. 有大数据处理经验（Spark、Hadoop）者优先`;

const DEMO_RESUMES = [
  {
    name: '张明.pdf',
    text: `张明
高级 Python 后端工程师

联系方式：zhangming@email.com | 138-0000-0001 | 上海

个人简介
拥有7年 Python 后端开发经验，精通 Django 和 Flask 框架。曾主导多个大型微服务系统的架构设计与落地，具备丰富的 Docker、Kubernetes 实践经验。熟悉 MySQL、Redis、PostgreSQL 等数据库，有 Elasticsearch 和 Kafka 使用经验。

教育背景
2011.09 - 2015.06  上海交通大学  计算机科学与技术  本科

工作经历
2021.03 - 至今    某互联网科技公司    高级后端工程师
- 负责核心交易系统后端架构设计，使用 Python + Django 重构旧系统
- 主导微服务拆分，使用 Docker 和 Kubernetes 部署 20+ 微服务
- 设计 MySQL 分库分表方案，Redis 缓存策略，系统 QPS 提升 5 倍
- 搭建 Jenkins CI/CD 流水线，部署效率提升 80%
- 使用 Elasticsearch 构建日志搜索平台，Kafka 处理异步消息
- 指导 3 名中级开发工程师，参与团队 Code Review

2018.07 - 2021.02    某金融科技公司    Python 后端工程师
- 使用 Flask 开发 RESTful API，服务日活百万级用户
- MySQL 数据库性能优化，慢查询从 500ms 降到 50ms
- Redis 缓存设计，热点数据命中率 95%+
- Nginx 反向代理配置与负载均衡
- 参与 Spark 大数据处理，处理 TB 级数据

2015.07 - 2018.06    某创业公司    后端开发工程师
- 使用 Python 开发后台管理系统
- MySQL 数据库设计与维护
- 基础 Linux 运维工作

技术栈
编程语言：Python, JavaScript, Shell
后端框架：Django, Flask, FastAPI, Tornado
数据库：MySQL, Redis, PostgreSQL, Elasticsearch, MongoDB
云与运维：Docker, Kubernetes, Jenkins, Nginx, Linux, CI/CD, 微服务
大数据：Spark, Hadoop, Kafka
版本控制：Git, GitLab

项目管理
- 带领 5 人团队完成交易系统重构项目
- 敏捷开发实践，Scrum 流程推进
- 跨部门协作，与产品、前端、测试团队紧密配合`
  },
  {
    name: '李华.pdf',
    text: `李华
全栈开发工程师

联系方式：lihua@email.com | 138-0000-0002 | 北京

个人简介
4年全栈开发经验，熟悉 Python 后端和 React 前端开发。有微服务和容器化经验，熟悉 MySQL 和 Redis。

教育背景
2016.09 - 2020.06  某普通一本院校  软件工程  本科

工作经历
2022.01 - 至今    某电商公司    全栈工程师
- 使用 Python + Django 开发后端 API
- React 前端开发，Vue 项目维护
- MySQL 数据库设计，Redis 缓存使用
- Docker 容器化部署，了解 Kubernetes
- 使用 Git 进行版本管理，GitLab CI 基础使用
- 与团队协作完成多个功能模块开发

2020.07 - 2021.12    某软件公司    后端开发工程师
- Flask 后端 API 开发
- MySQL 数据库操作和优化
- Linux 服务器基础运维
- 参与团队 Code Review

技术栈
编程语言：Python, JavaScript, TypeScript
后端框架：Django, Flask, Express
前端：React, Vue, HTML, CSS
数据库：MySQL, Redis, MongoDB
工具：Docker, Git, Linux, Nginx
其他：RESTful API, 敏捷开发`
  },
  {
    name: '王芳.pdf',
    text: `王芳
前端开发工程师

联系方式：wangfang@email.com | 138-0000-0003 | 杭州

个人简介
2年前端开发经验，熟悉 React 和 Vue 框架。对 Python 后端有基础了解，希望向前端方向发展。

教育背景
2018.09 - 2022.06  某二本院校  信息管理  本科

工作经历
2022.07 - 至今    某互联网公司    前端开发工程师
- React 前端页面开发
- Vue 项目维护和 Bug 修复
- HTML/CSS 页面制作
- 与后端对接 API

实习经历
2021.12 - 2022.06    某创业公司    前端实习生
- 使用 Vue 开发管理后台
- HTML 和 CSS 页面布局
- JavaScript 交互效果实现

技术栈
编程语言：JavaScript, HTML, CSS, 基础 Python
前端框架：React, Vue
数据库：了解 MySQL
工具：Git, Webpack
其他：微信小程序`
  },
  {
    name: '刘强.pdf',
    text: `刘强
数据工程师 / Python 开发

联系方式：liuqiang@email.com | 138-0000-0004 | 深圳

个人简介
6年数据工程和 Python 开发经验。专注于大数据处理和数据平台建设，有 Spark 和 Hadoop 丰富经验。后端开发使用 Django 和 FastAPI。

教育背景
2013.09 - 2017.06  浙江大学  数据科学  硕士

工作经历
2020.05 - 至今    某大数据公司    高级数据工程师
- 使用 Python + Spark 搭建大数据处理平台
- Kafka 实时数据流处理
- Hadoop 集群运维和数据仓库建设
- 使用 Django 开发数据管理后台
- FastAPI 开发数据服务接口
- Redis 缓存和 PostgreSQL 数据存储
- Docker 容器化部署，CI/CD 流水线
- 团队项目管理，带领 4 人小组

2017.07 - 2020.04    某科技公司    数据开发工程师
- Python 数据 ETL 脚本开发
- Spark 批处理任务开发
- MySQL 数据库设计和查询优化
- Hadoop 生态系统使用（Hive, HBase）
- Linux 服务器运维

技术栈
编程语言：Python, SQL, Scala, Shell
后端框架：Django, FastAPI
数据库：MySQL, PostgreSQL, Redis, MongoDB
大数据：Spark, Hadoop, Kafka, Hive
云与运维：Docker, Kubernetes, Linux, CI/CD
数据工具：Pandas, NumPy, Jupyter
版本控制：Git`
  }
];

// ========== 事件绑定 ==========
function initEvents() {
  // JD 输入实时统计
  const jdInput = $('#jdInput');
  jdInput.addEventListener('input', () => {
    state.jdText = jdInput.value;
    $('#jdCharCount').textContent = jdInput.value.length;

    if (jdInput.value.trim().length > 20) {
      const analysis = analyzeJD(jdInput.value);
      $('#jdSkillCount').textContent = analysis.skills.length;
      renderJDPreview(analysis);
    } else {
      $('#jdSkillCount').textContent = '0';
      $('#jdPreview').style.display = 'none';
    }
  });

  // 加载示例 JD
  $('#loadDemoJD').addEventListener('click', () => {
    jdInput.value = DEMO_JD;
    jdInput.dispatchEvent(new Event('input'));
  });

  // 下一步 → 上传简历
  $('#nextToUpload').addEventListener('click', () => {
    if (!state.jdText || state.jdText.trim().length < 10) {
      alert('请先输入职位描述 (JD)，至少 10 个字符');
      return;
    }
    state.jdAnalysis = analyzeJD(state.jdText);
    goToStep(2);
  });

  // 返回 JD
  $('#backToJD').addEventListener('click', () => goToStep(1));

  // 拖拽上传
  const dropZone = $('#dropZone');
  const fileInput = $('#fileInput');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
  });

  // 加载示例简历
  $('#loadDemoResumes').addEventListener('click', () => {
    DEMO_RESUMES.forEach(r => {
      state.resumes.push({
        name: r.name,
        text: r.text,
        size: r.text.length * 2,
        status: 'demo',
        file: null
      });
    });
    renderFileList();
  });

  // 开始分析
  $('#startAnalysis').addEventListener('click', runAnalysis);

  // 重新开始
  $('#restart').addEventListener('click', () => {
    state.jdText = '';
    state.jdAnalysis = null;
    state.resumes = [];
    state.rankedResumes = [];
    jdInput.value = '';
    jdInput.dispatchEvent(new Event('input'));
    goToStep(1);
  });

  // 导出报告
  $('#exportResults').addEventListener('click', exportReport);

  // 简历弹窗关闭
  $('#resumeModalClose').addEventListener('click', closeResumeModal);
  $('#resumeModalOverlay').addEventListener('click', (e) => {
    if (e.target === $('#resumeModalOverlay')) closeResumeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#resumeModalOverlay').classList.contains('active')) {
      closeResumeModal();
    }
  });

  // 邮箱导入按钮
  $('#emailImportBtn').addEventListener('click', openEmailImport);
  $('#emailModalClose').addEventListener('click', closeEmailModal);
  $('#emailModalOverlay').addEventListener('click', (e) => {
    if (e.target === $('#emailModalOverlay')) closeEmailModal();
  });
  $('#emailModalCancel').addEventListener('click', closeEmailModal);
  $('#emailModalImport').addEventListener('click', importSelectedResumes);
  $('#emailSelectAll').addEventListener('change', toggleSelectAll);

  // 邮箱配置事件
  $('#emailConfigSave').addEventListener('click', saveEmailConfig);
  $('#emailConfigUseDemo').addEventListener('click', useDemoEmailData);
  $('#emailPreset').addEventListener('change', (e) => {
    const val = e.target.value;
    const isCustom = val === 'custom';
    $('#emailCustomServerRow').style.display = isCustom ? 'flex' : 'none';

    // 国金证券自动切换到 POP3
    if (val === 'gjzq') {
      const pop3Radio = document.querySelector('input[name="emailProtocol"][value="pop3"]');
      const imapRadio = document.querySelector('input[name="emailProtocol"][value="imap"]');
      if (pop3Radio) pop3Radio.checked = true;
      if (imapRadio) imapRadio.disabled = true;
      $('#emailConfigHelp').textContent = '国金证券邮箱使用公司密码登录（非授权码）。服务器 email.gjzq.com.cn，POP3 端口 110，无 SSL';
    } else {
      const imapRadio = document.querySelector('input[name="emailProtocol"][value="imap"]');
      if (imapRadio) imapRadio.disabled = false;
      $('#emailConfigHelp').textContent = 'Outlook/Gmail 需使用「应用专用密码」；QQ/163 需使用「授权码」；公司内网邮箱直接用邮箱密码';
    }
  });
  // 协议切换时自动调整默认端口
  document.querySelectorAll('input[name="emailProtocol"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isCustom = $('#emailPreset').value === 'custom';
      if (isCustom) {
        const portInput = $('#emailCustomPort');
        const sslCheckbox = $('#emailCustomSSL');
        if (e.target.value === 'pop3') {
          // POP3 默认 110（明文）/ 995（SSL）
          portInput.value = sslCheckbox.checked ? 995 : 110;
        } else {
          // IMAP 默认 143（明文）/ 993（SSL）
          portInput.value = sslCheckbox.checked ? 993 : 143;
        }
      }
    });
  });
  $('#emailCustomSSL').addEventListener('change', (e) => {
    if ($('#emailPreset').value !== 'custom') return;
    const protocolRadio = document.querySelector('input[name="emailProtocol"]:checked');
    const protocol = protocolRadio ? protocolRadio.value : 'pop3';
    if (protocol === 'pop3') {
      $('#emailCustomPort').value = e.target.checked ? 995 : 110;
    } else {
      $('#emailCustomPort').value = e.target.checked ? 993 : 143;
    }
  });
  // 邮箱地址输入时自动推荐预设
  $('#emailAddr').addEventListener('input', (e) => {
    autoSelectPresetByEmail(e.target.value.trim());
  });

  // ====== 标签输入逻辑 ======
  const tagInput = $('#emailTagInput');
  const tagContainer = $('#emailTags');
  let emailTags = ['intern', '实习', '秋招', '求职'];

  function renderEmailTags() {
    tagContainer.innerHTML = emailTags.map((tag, i) =>
      `<span class="email-tag">${escapeHtml(tag)}<button type="button" class="email-tag-remove" data-index="${i}" title="移除">×</button></span>`
    ).join('');
  }

  function addEmailTag(tag) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (emailTags.includes(trimmed)) return;
    emailTags.push(trimmed);
    renderEmailTags();
  }

  function removeEmailTag(index) {
    emailTags.splice(index, 1);
    renderEmailTags();
  }

  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmailTag(e.target.value);
      e.target.value = '';
    }
    if (e.key === 'Backspace' && e.target.value === '' && emailTags.length > 0) {
      emailTags.pop();
      renderEmailTags();
    }
  });

  // 处理粘贴（支持逗号分隔批量粘贴）
  tagInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    if (!pasted) return;
    const tags = pasted.split(/[,，、\s]+/).filter(Boolean);
    tags.forEach(t => addEmailTag(t));
  });

  // 点击标签区域聚焦输入框
  tagContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('email-tag-remove')) {
      const idx = parseInt(e.target.dataset.index);
      removeEmailTag(idx);
    } else {
      tagInput.focus();
    }
  });
  renderEmailTags();

  // 关键词搜索按钮
  $('#emailKeywordSearch').addEventListener('click', () => {
    if (emailTags.length === 0) return;
    const keywordsStr = emailTags.join(',');
    const startDate = $('#emailStartDate').value || '';
    const endDate = $('#emailEndDate').value || '';
    startRealEmailSearch(keywordsStr, startDate, endDate);
  });

  // 清除日期按钮
  $('#emailClearDate').addEventListener('click', () => {
    $('#emailStartDate').value = '';
    $('#emailEndDate').value = '';
  });

  // 返回修改邮箱配置
  $('#emailKeywordBack').addEventListener('click', () => {
    $('#emailKeywordPanel').style.display = 'none';
    $('#emailConfigPanel').style.display = 'block';
    $('#emailConfigStatus').textContent = '';
    $('#emailConfigStatus').className = 'email-config-status';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#emailModalOverlay').classList.contains('active')) {
      closeEmailModal();
    }
  });
}

// 处理上传文件（并行解析所有 PDF）
async function handleFiles(files) {
  const pdfFiles = [];
  for (const file of files) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      continue; // 非静默跳过非 PDF
    }
    pdfFiles.push(file);
  }

  if (pdfFiles.length === 0) {
    showToast('请选择 PDF 格式的简历文件', 'warning');
    return;
  }

  // 批量创建简历对象，统一设为 parsing
  const newResumes = pdfFiles.map(file => ({
    name: file.name,
    text: '',
    size: file.size,
    status: 'parsing',
    file: file,
    error: null
  }));
  state.resumes.push(...newResumes);
  renderFileList();

  showToast(`正在解析 ${pdfFiles.length} 份简历...`, 'info');

  // 并行解析所有 PDF
  const promises = newResumes.map(async (resume) => {
    try {
      resume.text = await parsePDF(resume.file);
      resume.status = 'ready';
    } catch (e) {
      console.error('PDF parse error:', e);
      resume.status = 'error';
      resume.error = e.message || '解析失败';
    }
  });

  await Promise.all(promises);

  const successCount = newResumes.filter(r => r.status === 'ready').length;
  const failCount = newResumes.filter(r => r.status === 'error').length;

  if (failCount > 0) {
    showToast(`解析完成：${successCount} 份成功，${failCount} 份失败`, 'warning');
  } else {
    showToast(`${successCount} 份简历解析完成`, 'success');
  }

  renderFileList();
}

// ========== 邮箱导入功能 ==========
// 使用相对路径，自动适配本地 (localhost:8089) 和云端 (Render) 部署
const EMAIL_API_BASE = (() => {
  // 如果是 file:// 协议或同源，自动用相对路径
  if (typeof window === 'undefined') return '/api';
  const { protocol, hostname } = window.location;
  // file:// 协议（直接打开本地文件）→ 用相对路径但会失败，提示用户
  if (protocol === 'file:') return '/api';
  return '/api';
})();
let emailSearchResults = [];
let emailDemoMode = false;
let emailConfigLoaded = false;

/* ---- 邮箱配置 ---- */
function autoSelectPresetByEmail(email) {
  if (!email || !email.includes('@')) return;
  const domain = email.split('@')[1].toLowerCase();
  const map = {
    'outlook.com': 'outlook', 'hotmail.com': 'outlook', 'live.com': 'outlook', 'outlook.cn': 'outlook',
    'gmail.com': 'gmail',
    'qq.com': 'qq',
    '163.com': '163',
    '126.com': '126',
    'sina.com': 'sina', 'sina.cn': 'sina',
    'sohu.com': 'sohu',
    '139.com': '139',
    'gjzq.com.cn': 'gjzq',
  };
  let preset = '';
  for (const [suffix, key] of Object.entries(map)) {
    if (domain === suffix || domain.endsWith('.' + suffix)) {
      preset = key;
      break;
    }
  }
  if (!preset) return;
  const presetSelect = $('#emailPreset');
  if (presetSelect && presetSelect.value !== preset) {
    presetSelect.value = preset;
    // 触发 change 事件以更新协议提示
    presetSelect.dispatchEvent(new Event('change'));
  }
}

async function loadEmailConfig() {
  try {
    const resp = await fetch(`${EMAIL_API_BASE}/email-config`);
    const data = await resp.json();
    emailConfigLoaded = true;
    if (data.configured) {
      $('#emailConfigPanel').style.display = 'none';
      $('#emailConfigStatus').textContent = '';
      $('#emailConfigStatus').className = 'email-config-status';
    } else {
      $('#emailConfigPanel').style.display = 'block';
    }
    return data;
  } catch (e) {
    emailConfigLoaded = false;
    $('#emailConfigPanel').style.display = 'block';
    return { configured: false };
  }
}

async function saveEmailConfig() {
  const preset = $('#emailPreset').value;
  const email = $('#emailAddr').value.trim();
  const password = $('#emailPwd').value.trim();
  const customServer = $('#emailCustomServer').value.trim();
  const customPort = parseInt($('#emailCustomPort').value) || 110;
  const useSSL = $('#emailCustomSSL').checked;
  // 读取选中的协议
  const protocolRadio = document.querySelector('input[name="emailProtocol"]:checked');
  const protocol = protocolRadio ? protocolRadio.value : 'pop3';

  const status = $('#emailConfigStatus');
  status.className = 'email-config-status loading';
  status.textContent = `正在通过 ${protocol.toUpperCase()} 连接邮箱…`;

  const body = { preset, email, password, protocol };
  if (preset === 'custom') {
    body.server = customServer;
    body.port = customPort;
    body.ssl = useSSL;
  }

  try {
    const resp = await fetch(`${EMAIL_API_BASE}/email-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (data.success) {
      status.className = 'email-config-status success';
      if (data.warning) {
        status.textContent = '✓ ' + (data.message || '连接成功') + ' \n' + data.warning;
      }
      // 隐藏配置面板，显示关键词输入面板
      setTimeout(() => {
        $('#emailConfigPanel').style.display = 'none';
        $('#emailKeywordPanel').style.display = 'block';
        $('#emailConfigStatus').textContent = '';
        $('#emailConfigStatus').className = 'email-config-status';
      }, data.warning ? 2000 : 800);
    } else {
      status.className = 'email-config-status error';
      let msg = '✗ ' + (data.error || '连接失败');
      if (data.hint) msg += '\n' + data.hint;
      status.textContent = msg;
    }
  } catch (e) {
    status.className = 'email-config-status error';
    const loc = window.location;
    status.textContent = `✗ 无法连接后端服务 (${loc.host}/api) — 请确认 Python 后端正在运行`;
  }
}

async function startRealEmailSearch(keywordsStr, startDate, endDate) {
  const progress = $('#emailSearchProgress');
  $('#emailKeywordPanel').style.display = 'none';
  progress.style.display = 'block';
  $('#emailSearchProgressText').textContent = '正在连接邮箱并搜索匹配关键词的邮件…';

  const params = new URLSearchParams();
  params.set('keywords', keywordsStr);
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  try {
    const resp = await fetch(`${EMAIL_API_BASE}/search-emails?${params.toString()}`);
    const data = await resp.json();
    progress.style.display = 'none';

    if (data.success && data.total > 0) {
      emailSearchResults = data.emails;
      emailDemoMode = false;
      $('#emailResults').style.display = 'block';
      renderEmailResults(data);
    } else {
      $('#emailEmpty').style.display = 'block';
      const emptyTitle = $('#emailEmpty').querySelector('.email-empty-title');
      const emptyDesc = $('#emailEmpty').querySelector('.email-empty-desc');
      if (emptyTitle) emptyTitle.textContent = '未找到匹配的邮件';
      if (emptyDesc) emptyDesc.textContent = data.message || '邮箱中暂无匹配关键词的邮件，可返回修改关键词再试';
    }
  } catch (e) {
    progress.style.display = 'none';
    $('#emailEmpty').style.display = 'block';
  }
}

/* 打开邮箱导入弹窗 */
async function openEmailImport() {
  emailSearchResults = [];
  emailDemoMode = false;
  const overlay = $('#emailModalOverlay');
  const progress = $('#emailSearchProgress');
  const results = $('#emailResults');
  const empty = $('#emailEmpty');

  // 重置状态
  overlay.classList.add('active');
  progress.style.display = 'none';
  results.style.display = 'none';
  empty.style.display = 'none';
  $('#emailModalImport').disabled = true;
  $('#emailConfigStatus').textContent = '';
  $('#emailConfigStatus').className = 'email-config-status';

  // 先加载邮箱配置
  const config = await loadEmailConfig();

  if (config.configured) {
    // 已配置邮箱，显示关键词输入面板
    $('#emailConfigPanel').style.display = 'none';
    $('#emailKeywordPanel').style.display = 'block';
  } else {
    // 未配置，显示配置面板
    $('#emailConfigPanel').style.display = 'block';
    $('#emailKeywordPanel').style.display = 'none';
  }
}

/* 使用演示数据 */
function useDemoEmailData() {
  emailDemoMode = true;
  emailSearchResults = DEMO_EMAIL_DATA.emails;
  $('#emailConfigPanel').style.display = 'none';
  $('#emailSearchProgress').style.display = 'none';
  $('#emailResults').style.display = 'block';
  $('#emailEmpty').style.display = 'none';
  renderEmailResults(DEMO_EMAIL_DATA);
}
const DEMO_EMAIL_DATA = {
  success: true,
  total: 5,
  from_cache: true,
  last_updated: '2026-07-29T10:00:00Z',
  keywords: ['intern', '实习', '秋招', '求职'],
  emails: [
    {
      id: 'demo_msg_001',
      subject: '【实习申请】张三 - 前端开发实习生 - 2026暑期',
      from: 'zhangsan@example.com',
      date: '2026-07-28 14:30',
      snippet: '您好，我是张三，目前就读于某某大学计算机专业大三，看到贵司招聘前端开发实习生，特此投递简历。熟练掌握 React、Vue、TypeScript...',
      attachments: [
        {
          filename: '张三-前端开发实习生.pdf',
          size: 245760,
          downloaded: true,
          extracted_chars: 1200,
          parsed_text: `张三
手机号: 138****5678 | 邮箱: zhangsan@example.com
教育背景: 某某大学 - 计算机科学与技术 - 本科 - 2023.09-2027.06 (预计)
实习经历:
- 字节跳动 - 前端开发实习生 - 2026.03-至今
  · 负责抖音电商后台管理系统开发，使用 React + TypeScript
  · 参与组件库设计与开发，封装 30+ 通用组件
  · 优化页面性能，首屏加载时间减少 40%
- 美团 - 前端开发实习生 - 2025.07-2025.12
  · 参与美团外卖商家端小程序开发
  · 使用 Vue3 + Vite 重构 legacy 页面
  · 编写单元测试，测试覆盖率提升至 85%
项目经历:
- 个人博客系统 (React + Node.js)
  · 全栈开发，支持 Markdown 编辑、评论、标签系统
  · 使用 Next.js SSR 优化 SEO
技能: JavaScript, TypeScript, React, Vue, Node.js, Webpack, Git, HTML/CSS`
        }
      ]
    },
    {
      id: 'demo_msg_002',
      subject: '【实习】李四 - 后端开发实习 - Java/Python',
      from: 'lisi@example.com',
      date: '2026-07-27 09:15',
      snippet: '尊敬的招聘负责人，我是李四，某985高校软件工程专业大四学生，求职后端开发实习岗位。熟悉 Java Spring Boot、Python Flask...',
      attachments: [
        {
          filename: '李四-后端开发实习生.pdf',
          size: 189440,
          downloaded: true,
          extracted_chars: 980,
          parsed_text: `李四
手机号: 139****9012 | 邮箱: lisi@example.com
教育背景: 某985大学 - 软件工程 - 本科 - 2022.09-2026.06
实习经历:
- 阿里巴巴 - Java后端开发实习生 - 2026.01-至今
  · 参与淘宝交易系统核心模块开发
  · 使用 Spring Boot + MySQL + Redis 开发订单服务
  · 编写技术文档，完成代码 review 200+ 次
项目经历:
- 分布式任务调度平台 (Spring Boot + Kafka)
  · 设计实现支持 10万+QPS 的任务调度系统
  · 使用 Kafka 做任务分发，保证消息不丢失
  · 集成 Prometheus + Grafana 监控报警
技能: Java, Python, Spring Boot, MySQL, Redis, Kafka, Docker, Linux`
        }
      ]
    },
    {
      id: 'demo_msg_003',
      subject: '实习简历 - 王五 - 数据分析实习生',
      from: 'wangwu@example.com',
      date: '2026-07-26 16:45',
      snippet: '你好，我是王五，统计学专业研究生在读，对数据分析岗位很感兴趣。熟悉 SQL、Python pandas、数据可视化...',
      attachments: [
        {
          filename: '王五-数据分析实习生.pdf',
          size: 156672,
          downloaded: true,
          extracted_chars: 850,
          parsed_text: `王五
手机号: 137****3456 | 邮箱: wangwu@example.com
教育背景: 某财经大学 - 统计学 - 硕士 - 2024.09-2027.06 (预计)
实习经历:
- 腾讯 - 数据分析实习生 - 2025.12-2026.06
  · 负责微信用户行为数据分析，产出周报月报
  · 使用 SQL + Python 搭建用户画像模型
  · 通过 A/B 测试优化产品功能，提升留存 5%
项目经历:
- 电商用户流失预测模型
  · 使用 Python scikit-learn 构建 XGBoost 预测模型
  · AUC 达到 0.85，准确识别 70% 流失用户
  · 可视化分析结果，产出策略建议报告
技能: Python, SQL, Excel, Tableau, SPSS, R, Pandas, NumPy`
        }
      ]
    },
    {
      id: 'demo_msg_004',
      subject: '【秋招求职】赵六 - 全栈开发实习',
      from: 'zhaoliu@example.com',
      date: '2026-07-25 11:20',
      snippet: 'HR 你好，我是赵六，正在寻找 2026 秋季的全栈开发实习机会。技术栈 React + Node.js + MongoDB...',
      attachments: [
        {
          filename: '赵六-全栈开发实习.pdf',
          size: 212992,
          downloaded: true,
          extracted_chars: 1100,
          parsed_text: `赵六
手机号: 136****7890 | 邮箱: zhaoliu@example.com
教育背景: 某科技大学 - 计算机科学 - 本科 - 2022.09-2026.06
实习经历:
- 滴滴出行 - 全栈开发实习生 - 2025.09-2026.03
  · 负责司机端 H5 页面开发与后端 API 设计
  · 使用 React + Express + MongoDB 全栈开发
  · 实现实时消息推送，WebSocket 连接稳定性 99.9%
- 小红书 - 前端开发实习生 - 2025.03-2025.08
  · 参与社区内容发布页重构
  · 优化图片上传组件，支持断点续传
  · 使用 Canvas 实现图片裁剪与滤镜功能
项目经历:
- 在线教育平台 (MERN 全栈)
  · 独立开发，包含视频播放、直播、作业系统
  · 使用 WebRTC 实现实时音视频通话
技能: JavaScript, React, Node.js, Express, MongoDB, WebSocket, WebRTC, Docker`
        }
      ]
    },
    {
      id: 'demo_msg_005',
      subject: '求职申请 - 孙七 - AI算法实习生',
      from: 'sunqi@example.com',
      date: '2026-07-24 08:00',
      snippet: '您好，我是孙七，人工智能专业博士在读，研究方向为 NLP 与大模型。希望申请贵司 AI 算法实习岗位...',
      attachments: [
        {
          filename: '孙七-AI算法实习生.pdf',
          size: 278528,
          downloaded: true,
          extracted_chars: 1350,
          parsed_text: `孙七
手机号: 135****2345 | 邮箱: sunqi@example.com
教育背景: 某顶尖高校 - 人工智能 - 博士 - 2023.09-2027.06 (预计)
  · GPA: 3.9/4.0，获国家奖学金
  · 发表顶会论文 2 篇 (ACL, NeurIPS)
实习经历:
- 百度 - AI算法实习生 - 2025.06-2026.01
  · 参与文心一言大模型训练数据清洗与质量评估
  · 设计实现 RLHF 奖励模型，提升回答质量 15%
  · 使用 PyTorch + DeepSpeed 进行分布式训练
- 商汤科技 - 计算机视觉实习生 - 2024.07-2025.01
  · 参与人脸识别算法优化，准确率提升至 99.5%
  · 使用 TensorRT 优化推理速度，延迟降低 60%
项目经历:
- 多模态大模型微调项目
  · 基于 LLaVA 架构，微调视觉语言模型
  · 在自定义数据集上达到 SOTA 效果
技能: Python, PyTorch, TensorFlow, Transformers, CUDA, DeepSpeed, LangChain, OpenAI API`
        }
      ]
    }
  ]
};

/* 渲染邮箱搜索结果 */
function renderEmailResults(data) {
  const list = $('#emailResultsList');
  list.innerHTML = '';

  $('#emailResultCount').textContent = data.total;
  $('#emailCacheInfo').textContent = data.from_cache
    ? `缓存时间: ${new Date(data.last_updated).toLocaleString('zh-CN')}`
    : '实时搜索';

  data.emails.forEach((email, idx) => {
    const item = document.createElement('div');
    item.className = 'email-result-item selected';
    item.dataset.index = idx;

    const attachments = email.attachments || [];
    const attHtml = attachments.map(att => {
      const downloaded = att.downloaded || att.extracted_chars > 0;
      const cls = downloaded ? 'downloaded' : '';
      return `<span class="email-result-attachment ${cls}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        ${att.filename} ${downloaded ? '(已解析)' : ''}
      </span>`;
    }).join('');

    item.innerHTML = `
      <div class="email-result-checkbox">
        <input type="checkbox" data-idx="${idx}" checked>
      </div>
      <div class="email-result-info">
        <div class="email-result-subject">${escapeHtml(email.subject)}</div>
        <div class="email-result-from">${escapeHtml(email.from)} · ${escapeHtml(email.date || '')}</div>
        <div class="email-result-snippet">${escapeHtml(email.snippet || '')}</div>
        ${attHtml}
      </div>
    `;

    item.addEventListener('click', function(e) {
      // 不拦截 checkbox 的点击
      if (e.target.tagName === 'INPUT') return;
      const cb = this.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
      this.classList.toggle('selected', cb.checked);
      updateImportButton();
    });

    list.appendChild(item);
  });

  updateImportButton();
}

/* 更新导入按钮状态 */
function updateImportButton() {
  const checkboxes = document.querySelectorAll('#emailResultsList input[type="checkbox"]');
  const count = Array.from(checkboxes).filter(cb => cb.checked).length;
  const btn = $('#emailModalImport');
  btn.disabled = count === 0;
  btn.innerHTML = count > 0
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
       导入选中简历 (${count})`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
       导入选中简历`;
}

/* 全选/取消全选 */
function toggleSelectAll() {
  const allChecked = $('#emailSelectAll').checked;
  const checkboxes = document.querySelectorAll('#emailResultsList input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = allChecked;
    cb.closest('.email-result-item').classList.toggle('selected', allChecked);
  });
  updateImportButton();
}

/* 批量导入选中的简历 */
async function importSelectedResumes() {
  const checkboxes = document.querySelectorAll('#emailResultsList input[type="checkbox"]');
  const selectedIds = [];
  checkboxes.forEach(cb => {
    if (cb.checked) {
      const idx = parseInt(cb.dataset.idx);
      if (emailSearchResults[idx]) {
        selectedIds.push(emailSearchResults[idx].id);
      }
    }
  });

  if (selectedIds.length === 0) return;

  // 显示导入进度
  closeEmailModal();
  showImportProgress(0, selectedIds.length);

  // 演示模式：直接从嵌入数据提取，无需调后端
  if (emailDemoMode) {
    let imported = 0;
    selectedIds.forEach(id => {
      const email = DEMO_EMAIL_DATA.emails.find(e => e.id === id);
      if (!email) return;
      email.attachments.forEach(att => {
        if (!att.parsed_text || att.parsed_text.trim().length < 50) return;
        state.resumes.push({
          name: att.filename.replace(/\.pdf$|\.docx?$/i, ''),
          text: att.parsed_text,
          size: att.size,
          status: 'ready',
          file: null
        });
        imported++;
      });
    });

    updateImportProgress(imported, selectedIds.length, 0);
    setTimeout(() => {
      removeImportProgress();
      renderFileList();
      showToast(`成功导入 ${imported} 份演示简历（演示模式）`, 'success');
      updateAnalysisButton();
    }, 800);
    return;
  }

  try {
    const resp = await fetch(`${EMAIL_API_BASE}/batch-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_ids: selectedIds,
        keywords: 'intern,实习,秋招,求职'
      })
    });
    const data = await resp.json();

    if (!data.success) {
      removeImportProgress();
      showToast('导入失败: ' + (data.error || '未知错误'), 'warning');
      return;
    }

    // 添加到 state.resumes
    let imported = 0;
    data.resumes.forEach(r => {
      if (!r.text || r.text.trim().length < 50) return; // 跳过空简历
      state.resumes.push({
        name: r.name,
        text: r.text,
        size: r.size,
        status: 'ready',
        file: null
      });
      imported++;
    });

    updateImportProgress(imported, selectedIds.length, data.skipped);

    // 延迟一下让用户看到完成状态
    setTimeout(() => {
      removeImportProgress();
      renderFileList();
      showToast(`成功从邮箱导入 ${imported} 份实习生简历`, 'success');

      // 如果之前没加载过示例简历且有 JD，自动高亮开始分析按钮
      updateAnalysisButton();
    }, 800);

  } catch (err) {
    console.error('Email import error:', err);
    removeImportProgress();
    showToast('导入失败，请检查网络连接', 'warning');
  }
}

/* 导入进度 UI */
function showImportProgress(current, total) {
  // 移除旧的
  removeImportProgress();

  const overlay = document.createElement('div');
  overlay.id = 'importProgressOverlay';
  overlay.className = 'email-import-progress';
  overlay.innerHTML = `
    <div class="email-import-progress-box">
      <div class="spinner"></div>
      <div class="title">正在从邮箱导入简历</div>
      <div class="detail" id="importProgressDetail">正在提取简历文本…</div>
      <div class="count" id="importProgressCount">${current} / ${total}</div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function updateImportProgress(current, total, skipped) {
  const countEl = document.getElementById('importProgressCount');
  const detailEl = document.getElementById('importProgressDetail');
  if (countEl) countEl.textContent = `${current} / ${total}`;
  if (detailEl) {
    const msg = skipped > 0
      ? `已导入 ${current} 份，跳过 ${skipped} 份`
      : `导入完成！共 ${current} 份简历`;
    detailEl.textContent = msg;
  }
}

function removeImportProgress() {
  const el = document.getElementById('importProgressOverlay');
  if (el) el.remove();
}

/* 关闭邮箱导入弹窗 */
function closeEmailModal() {
  $('#emailModalOverlay').classList.remove('active');
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== Toast 提示 ==========
function showToast(message, type) {
  // 移除旧的 toast
  const oldToast = document.querySelector('.toast-msg');
  if (oldToast) oldToast.remove();

  const colors = {
    success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: ICONS.check },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: ICONS.helpCircle },
    info:    { bg: '#eef2ff', border: '#c7d2fe', text: '#4338ca', icon: ICONS.lightbulb }
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.style.cssText = `
    position:fixed;top:80px;left:50%;transform:translateX(-50%);
    background:${c.bg};border:1px solid ${c.border};color:${c.text};
    padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;
    display:flex;align-items:center;gap:8px;z-index:9999;
    box-shadow:0 4px 12px rgba(0,0,0,0.1);animation:toastIn .3s ease;
    max-width:400px;
  `;
  toast.innerHTML = `<span class="icon" style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${c.icon}</span> ${message}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ========== 初始化 ==========
initEvents();
