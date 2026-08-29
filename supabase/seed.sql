-- ============================================================
-- TalentFlow AI — seed data
--
-- Enough of a catalog to demo the whole loop: extract skills from a
-- résumé, match against open positions, recommend assessments and
-- courses, generate an upskilling plan.
--
-- Safe to re-run: every insert is guarded.
-- Run AFTER 0001-0004. Does not create users — sign up through the app.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Skills taxonomy
-- ------------------------------------------------------------
insert into public.skills_taxonomy (name, category, description) values
  ('Python',                  'technical', 'General-purpose programming language'),
  ('SQL',                     'technical', 'Relational query language'),
  ('JavaScript',              'technical', 'Programming language for the web'),
  ('TypeScript',              'technical', 'Typed superset of JavaScript'),
  ('React',                   'technical', 'Component-based UI library'),
  ('Next.js',                 'technical', 'React application framework'),
  ('Node.js',                 'technical', 'Server-side JavaScript runtime'),
  ('PostgreSQL',              'technical', 'Relational database'),
  ('Data Analysis',           'technical', 'Exploring and summarizing data'),
  ('Machine Learning',        'technical', 'Building predictive models'),
  ('Prompt Engineering',      'technical', 'Designing prompts for language models'),
  ('LLM Integration',         'technical', 'Wiring language models into applications'),
  ('Power BI',                'technical', 'Business intelligence and dashboards'),
  ('Excel',                   'technical', 'Spreadsheet modeling and analysis'),
  ('Tableau',                 'technical', 'Data visualization platform'),
  ('AWS',                     'technical', 'Amazon Web Services cloud platform'),
  ('Docker',                  'technical', 'Container packaging and runtime'),
  ('Git',                     'technical', 'Version control'),
  ('REST APIs',               'technical', 'Designing and consuming HTTP APIs'),
  ('ETL',                     'technical', 'Extract, transform, load pipelines'),

  ('Communication',           'soft',      'Explaining ideas clearly to others'),
  ('Leadership',              'soft',      'Guiding and motivating a team'),
  ('Problem Solving',         'soft',      'Breaking down and resolving issues'),
  ('Collaboration',           'soft',      'Working effectively across a team'),
  ('Adaptability',            'soft',      'Adjusting to changing priorities'),
  ('Critical Thinking',       'soft',      'Evaluating evidence and arguments'),
  ('Presentation Skills',     'soft',      'Presenting to an audience'),
  ('Mentoring',               'soft',      'Developing other people'),

  ('Agile',                   'process',   'Iterative delivery methodology'),
  ('Scrum',                   'process',   'Agile framework with sprints'),
  ('Project Management',      'process',   'Planning and delivering projects'),
  ('Stakeholder Management',  'process',   'Aligning expectations across parties'),
  ('Requirements Gathering',  'process',   'Eliciting and documenting needs'),
  ('QA Testing',              'process',   'Verifying software behavior'),
  ('Process Improvement',     'process',   'Making workflows measurably better'),

  ('Talent Acquisition',      'domain',    'Sourcing and hiring candidates'),
  ('HR Analytics',            'domain',    'Measuring workforce outcomes'),
  ('Financial Analysis',      'domain',    'Interpreting financial statements'),
  ('Customer Support',        'domain',    'Resolving customer issues'),
  ('Product Management',      'domain',    'Owning a product and its roadmap'),
  ('Marketing Analytics',     'domain',    'Measuring campaign performance'),
  ('Compliance',              'domain',    'Meeting regulatory obligations')
on conflict do nothing;

-- ------------------------------------------------------------
-- 2. Open positions
-- ------------------------------------------------------------
insert into public.job_postings (title, description, department, team, location, work_mode, status, urgency, salary_min, salary_max)
select * from (values
  ('Data Analyst',
   'Turn operational data into decisions. You will build dashboards, answer questions from the business, and partner with product teams on measurement.',
   'Analytics', 'Business Intelligence', 'New York, NY', 'hybrid', 'open', 'high', 85000, 110000),
  ('Junior Machine Learning Engineer',
   'Support the ML team in building, evaluating and shipping models. A strong Python background matters more than prior ML job experience.',
   'Engineering', 'Applied ML', 'Remote', 'remote', 'open', 'medium', 95000, 125000),
  ('Frontend Engineer',
   'Build the interfaces our internal users live in. React and TypeScript day to day, with a real say in product decisions.',
   'Engineering', 'Platform', 'Austin, TX', 'hybrid', 'open', 'high', 100000, 135000),
  ('Technical Recruiter',
   'Own hiring for engineering roles end to end, from sourcing through offer. You will work closely with hiring managers on what good looks like.',
   'People', 'Talent Acquisition', 'New York, NY', 'onsite', 'open', 'medium', 75000, 95000),
  ('Product Manager, Internal Tools',
   'Own the roadmap for the tools our own teams use. Heavy on discovery, prioritization and measurement.',
   'Product', 'Internal Platform', 'Remote', 'remote', 'open', 'low', 110000, 145000),
  ('People Analytics Specialist',
   'Measure workforce outcomes: retention, internal mobility, hiring funnel health. Build the reporting the leadership team runs on.',
   'People', 'HR Analytics', 'Chicago, IL', 'hybrid', 'open', 'medium', 90000, 115000)
) as v(title, description, department, team, location, work_mode, status, urgency, salary_min, salary_max)
where not exists (
  select 1 from public.job_postings j where j.title = v.title
);

-- ------------------------------------------------------------
-- 3. Required / nice-to-have skills per position
-- ------------------------------------------------------------
insert into public.job_required_skills (job_id, skill_id, is_required)
select j.id, s.id, v.is_required
from (values
  ('Data Analyst',                     'SQL',                    true),
  ('Data Analyst',                     'Excel',                  true),
  ('Data Analyst',                     'Data Analysis',          true),
  ('Data Analyst',                     'Power BI',               true),
  ('Data Analyst',                     'Python',                 false),
  ('Data Analyst',                     'Communication',          false),

  ('Junior Machine Learning Engineer', 'Python',                 true),
  ('Junior Machine Learning Engineer', 'Machine Learning',       true),
  ('Junior Machine Learning Engineer', 'SQL',                    true),
  ('Junior Machine Learning Engineer', 'Docker',                 false),
  ('Junior Machine Learning Engineer', 'AWS',                    false),
  ('Junior Machine Learning Engineer', 'Problem Solving',        false),

  ('Frontend Engineer',                'JavaScript',             true),
  ('Frontend Engineer',                'TypeScript',             true),
  ('Frontend Engineer',                'React',                  true),
  ('Frontend Engineer',                'Git',                    true),
  ('Frontend Engineer',                'Next.js',                false),
  ('Frontend Engineer',                'Collaboration',          false),

  ('Technical Recruiter',              'Talent Acquisition',     true),
  ('Technical Recruiter',              'Communication',          true),
  ('Technical Recruiter',              'Stakeholder Management', true),
  ('Technical Recruiter',              'HR Analytics',           false),
  ('Technical Recruiter',              'Excel',                  false),

  ('Product Manager, Internal Tools',  'Product Management',     true),
  ('Product Manager, Internal Tools',  'Requirements Gathering', true),
  ('Product Manager, Internal Tools',  'Stakeholder Management', true),
  ('Product Manager, Internal Tools',  'Agile',                  true),
  ('Product Manager, Internal Tools',  'SQL',                    false),
  ('Product Manager, Internal Tools',  'Presentation Skills',    false),

  ('People Analytics Specialist',      'HR Analytics',           true),
  ('People Analytics Specialist',      'SQL',                    true),
  ('People Analytics Specialist',      'Data Analysis',          true),
  ('People Analytics Specialist',      'Tableau',                false),
  ('People Analytics Specialist',      'Critical Thinking',      false)
) as v(job_title, skill_name, is_required)
join public.job_postings   j on j.title = v.job_title
join public.skills_taxonomy s on lower(s.name) = lower(v.skill_name)
on conflict (job_id, skill_id) do nothing;

-- ------------------------------------------------------------
-- 4. Assessments (one per skill the app can verify)
-- ------------------------------------------------------------
insert into public.assessments (name, description, skill_id, duration_minutes, passing_score, difficulty)
select v.name, v.description, s.id, v.duration_minutes, v.passing_score, v.difficulty
from (values
  ('SQL Fundamentals',        'Joins, aggregation, and window basics.',            'SQL',               20, 70, 'intermediate'),
  ('Python Essentials',       'Data structures, control flow, and idioms.',        'Python',            20, 70, 'intermediate'),
  ('Data Analysis Practice',  'Interpreting datasets and drawing conclusions.',    'Data Analysis',     25, 70, 'intermediate'),
  ('React Core Concepts',     'Components, state, effects, and rendering.',        'React',             20, 75, 'intermediate'),
  ('TypeScript Basics',       'Types, generics, and narrowing.',                   'TypeScript',        15, 70, 'beginner'),
  ('Excel for Analysts',      'Lookups, pivots, and modeling patterns.',           'Excel',             15, 70, 'beginner'),
  ('Agile & Scrum',           'Ceremonies, roles, and backlog practice.',          'Scrum',             15, 70, 'beginner'),
  ('Stakeholder Management',  'Aligning competing priorities.',                    'Stakeholder Management', 15, 70, 'intermediate'),
  ('Machine Learning Basics', 'Training, evaluation, and overfitting.',            'Machine Learning',  25, 75, 'advanced'),
  ('Prompt Engineering',      'Designing and evaluating prompts.',                 'Prompt Engineering', 20, 70, 'intermediate')
) as v(name, description, skill_name, duration_minutes, passing_score, difficulty)
join public.skills_taxonomy s on lower(s.name) = lower(v.skill_name)
where not exists (
  select 1 from public.assessments a where a.name = v.name
);

-- ------------------------------------------------------------
-- 5. Courses
-- ------------------------------------------------------------
insert into public.courses (name, provider, url, description, duration_hours, level, rating, cost, enrolled_count)
select * from (values
  ('SQL for Data Analysis',          'Coursera',  'https://www.coursera.org/', 'Query relational data with confidence.',            18, 'beginner',     4.7,   0.00, 1240),
  ('Python for Everybody',           'Coursera',  'https://www.coursera.org/', 'Programming foundations in Python.',                40, 'beginner',     4.8,   0.00, 3100),
  ('Machine Learning Specialization','Coursera',  'https://www.coursera.org/', 'Supervised learning end to end.',                   60, 'intermediate', 4.9,  49.00,  980),
  ('React — The Complete Guide',     'Udemy',     'https://www.udemy.com/',    'Modern React with hooks and routing.',              48, 'intermediate', 4.6,  19.99, 2200),
  ('Understanding TypeScript',       'Udemy',     'https://www.udemy.com/',    'Types, generics, and tooling.',                     15, 'beginner',     4.6,  19.99,  760),
  ('Data Visualization with Tableau','Coursera',  'https://www.coursera.org/', 'Build dashboards people actually use.',             24, 'beginner',     4.5,   0.00,  640),
  ('Agile with Atlassian Jira',      'Coursera',  'https://www.coursera.org/', 'Run a Scrum board in practice.',                    12, 'beginner',     4.4,   0.00,  530),
  ('People Analytics',               'Coursera',  'https://www.coursera.org/', 'Measuring workforce outcomes.',                     16, 'intermediate', 4.5,   0.00,  410),
  ('Prompt Engineering for Developers','DeepLearning.AI','https://www.deeplearning.ai/', 'Practical prompting patterns.',            6, 'beginner',     4.8,   0.00, 1500),
  ('AWS Cloud Practitioner Essentials','AWS',     'https://aws.amazon.com/training/', 'Core cloud concepts and services.',           14, 'beginner',     4.5,   0.00,  890)
) as v(name, provider, url, description, duration_hours, level, rating, cost, enrolled_count)
where not exists (
  select 1 from public.courses c where c.name = v.name
);

-- ------------------------------------------------------------
-- 6. Which skills each course teaches
-- ------------------------------------------------------------
insert into public.course_skills (course_id, skill_id)
select c.id, s.id
from (values
  ('SQL for Data Analysis',             'SQL'),
  ('SQL for Data Analysis',             'Data Analysis'),
  ('Python for Everybody',              'Python'),
  ('Machine Learning Specialization',   'Machine Learning'),
  ('Machine Learning Specialization',   'Python'),
  ('React — The Complete Guide',        'React'),
  ('React — The Complete Guide',        'JavaScript'),
  ('Understanding TypeScript',          'TypeScript'),
  ('Data Visualization with Tableau',   'Tableau'),
  ('Data Visualization with Tableau',   'Data Analysis'),
  ('Agile with Atlassian Jira',         'Agile'),
  ('Agile with Atlassian Jira',         'Scrum'),
  ('People Analytics',                  'HR Analytics'),
  ('People Analytics',                  'Data Analysis'),
  ('Prompt Engineering for Developers', 'Prompt Engineering'),
  ('Prompt Engineering for Developers', 'LLM Integration'),
  ('AWS Cloud Practitioner Essentials', 'AWS')
) as v(course_name, skill_name)
join public.courses         c on c.name = v.course_name
join public.skills_taxonomy s on lower(s.name) = lower(v.skill_name)
on conflict (course_id, skill_id) do nothing;
