import { BrowserRouter as Router } from 'react-router-dom';
import Toast from './components/common/Toast';
import AppRoutes from './routes/AppRoutes';
import './App.css';

function App() {
  return (
    <Router>
      <Toast />
      <AppRoutes />
    </Router>
  );
}

export default App;
