const STORAGE_KEY = 'review-note-progress-v1';
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const state = {
  questions: [],
  pool: [],
  current: 0,
  activeGroup: '전체 복습',
  solved: new Set(),
  checked: false,
};

const el = (id) => document.getElementById(id);

async function start() {
  try {
    const response = await fetch('./questions.json');
    if (!response.ok) throw new Error('문제 데이터를 불러오지 못했습니다.');
    state.questions = await response.json();
    state.pool = [...state.questions];
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      state.solved = new Set(saved.filter((id) => state.questions.some((q) => q.id === id)));
    } catch {
      state.solved = new Set();
    }
    renderTopics();
    renderQuestion();
    updateProgress();
    el('footer-total').textContent = `천천히 풀어보는 ${state.questions.length}문제`;
  } catch (error) {
    el('question-prompt').textContent = error.message;
    el('footer-total').textContent = '새로고침 후 다시 시도해 주세요.';
    el('answer-area').replaceChildren();
  }
}

function groups() {
  return [...new Set(state.questions.map((q) => q.group))];
}

function renderTopics() {
  const list = el('topic-list');
  list.replaceChildren();
  const topics = [
    { name: '전체 복습', icon: '◌', count: state.questions.length },
    ...groups().map((name, index) => ({
      name,
      icon: index === 0 ? '⌘' : '▤',
      count: state.questions.filter((q) => q.group === name).length,
    })),
  ];
  el('topic-count').textContent = `${topics.length - 1}개`;
  for (const topic of topics) {
    const button = document.createElement('button');
    button.className = 'topic-button';
    button.type = 'button';
    button.setAttribute('aria-current', String(topic.name === state.activeGroup));
    const label = document.createElement('span');
    label.className = 'topic-label';
    const icon = document.createElement('span');
    icon.className = 'topic-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = topic.icon;
    const text = document.createElement('span');
    text.textContent = topic.name;
    label.append(icon, text);
    const size = document.createElement('span');
    size.className = 'topic-size';
    size.textContent = String(topic.count).padStart(2, '0');
    button.append(label, size);
    button.addEventListener('click', () => selectGroup(topic.name));
    list.append(button);
  }
}

function selectGroup(name) {
  state.activeGroup = name;
  state.pool = name === '전체 복습' ? [...state.questions] : state.questions.filter((q) => q.group === name);
  state.current = 0;
  renderTopics();
  renderQuestion();
}

function renderQuestion() {
  const q = state.pool[state.current];
  if (!q) return;
  state.checked = false;
  el('question-group').textContent = q.group;
  el('question-number').innerHTML = `${String(state.current + 1).padStart(2, '0')} <span>/ ${String(state.pool.length).padStart(2, '0')}</span>`;
  el('question-progress-fill').style.width = `${((state.current + 1) / state.pool.length) * 100}%`;
  el('question-kind').textContent = q.choices.length ? '선택형' : '직접 작성';
  el('question-prompt').textContent = q.prompt;

  const codeBox = el('question-code');
  codeBox.hidden = !q.code;
  codeBox.querySelector('code').textContent = q.code || '';

  const area = el('answer-area');
  area.replaceChildren();
  if (q.choices.length) {
    q.choices.forEach((choice, index) => {
      const label = document.createElement('label');
      label.className = 'choice';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `answer-${q.id}`;
      radio.value = String(index);
      const letter = document.createElement('span');
      letter.className = 'choice-letter';
      letter.textContent = LETTERS[index] || String(index + 1);
      const text = document.createElement('span');
      text.textContent = choice;
      label.append(radio, letter, text);
      area.append(label);
    });
  } else {
    const answer = document.createElement('textarea');
    answer.className = 'short-answer';
    answer.id = 'short-answer';
    answer.placeholder = '생각한 답을 자유롭게 적어 보세요.';
    answer.setAttribute('aria-label', '내 답안');
    area.append(answer);
  }

  el('feedback').hidden = true;
  el('feedback').className = 'feedback';
  el('completion-card').hidden = state.solved.size < state.questions.length;
  el('check-answer').hidden = false;
  el('check-answer').disabled = false;
  el('next-question').hidden = true;
  el('prev-question').disabled = state.current === 0;
  if (state.solved.has(q.id)) {
    el('check-answer').textContent = '다시 답 확인하기';
  } else {
    el('check-answer').innerHTML = '답 확인하기 <span aria-hidden="true">↗</span>';
  }
}

function checkAnswer() {
  if (state.checked) {
    el('next-question').hidden = false;
    return;
  }
  const q = state.pool[state.current];
  let correct = false;
  let response;
  if (q.choices.length) {
    const selected = document.querySelector(`input[name="answer-${q.id}"]:checked`);
    if (!selected) return toast('답을 하나 골라 주세요.');
    const selectedIndex = Number(selected.value);
    correct = q.answerIndex === selectedIndex;
    response = `선택한 답: ${LETTERS[selectedIndex] || selectedIndex + 1}. ${q.choices[selectedIndex]}`;
    document.querySelectorAll(`input[name="answer-${q.id}"]`).forEach((radio, index) => {
      radio.disabled = true;
      const label = radio.closest('.choice');
      if (index === q.answerIndex) label.classList.add('is-correct');
      else if (index === selectedIndex) label.classList.add('is-wrong');
      else label.classList.add('is-muted');
    });
  } else {
    const input = el('short-answer');
    if (!input.value.trim()) return toast('먼저 생각한 답을 적어 주세요.');
    input.disabled = true;
    response = '작성한 답을 예시 답안과 비교해 보세요.';
  }

  state.checked = true;
  state.solved.add(q.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.solved]));
  const feedback = el('feedback');
  feedback.replaceChildren();
  feedback.classList.toggle('is-wrong', q.choices.length > 0 && !correct);
  const title = document.createElement('strong');
  title.textContent = q.choices.length ? (correct ? '맞았어요!' : '다시 살펴볼 부분이 있어요.') : '답안을 확인해 보세요.';
  const answer = document.createElement('span');
  answer.textContent = q.choices.length
    ? `정답: ${LETTERS[q.answerIndex] || q.answerIndex + 1}. ${q.choices[q.answerIndex] || q.answerText}`
    : `예시 답안: ${q.answerText}`;
  feedback.append(title, answer);
  if (q.explanation) {
    const explanation = document.createElement('p');
    explanation.className = 'explanation';
    explanation.textContent = q.explanation;
    feedback.append(explanation);
  }
  feedback.hidden = false;
  el('check-answer').hidden = true;
  el('next-question').hidden = false;
  updateProgress();
  el('completion-card').hidden = state.solved.size < state.questions.length;
}

function updateProgress() {
  const total = state.questions.length;
  const count = state.solved.size;
  const percent = total ? Math.round((count / total) * 100) : 0;
  el('solved-count').textContent = String(count);
  el('total-count').textContent = String(total);
  el('progress-fill').style.width = `${percent}%`;
  el('progress-track').setAttribute('aria-valuenow', String(percent));
  el('progress-caption').textContent = count === total ? '오늘 복습을 모두 마쳤어요.' : count ? '좋아요, 계속 이어가 봐요.' : '한 문제씩 시작해 봐요.';
}

function nextQuestion() {
  state.current = (state.current + 1) % state.pool.length;
  renderQuestion();
}

function previousQuestion() {
  if (state.current > 0) {
    state.current -= 1;
    renderQuestion();
  }
}

function shuffleQuestions() {
  for (let i = state.pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.pool[i], state.pool[j]] = [state.pool[j], state.pool[i]];
  }
  state.current = 0;
  renderQuestion();
  toast('문제 순서를 섞었어요.');
}

let toastTimer;
function toast(message) {
  const node = el('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2100);
}

el('check-answer').addEventListener('click', checkAnswer);
el('next-question').addEventListener('click', nextQuestion);
el('prev-question').addEventListener('click', previousQuestion);
el('shuffle-questions').addEventListener('click', shuffleQuestions);
el('reset-progress').addEventListener('click', () => {
  state.solved.clear();
  localStorage.removeItem(STORAGE_KEY);
  updateProgress();
  renderQuestion();
  toast('진행 기록을 지웠어요.');
});

start();
