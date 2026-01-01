import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Layout } from './Layout';

describe('Layout', () => {
  it('should render header, main, and footer', () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    // Header elements (use getAllByText since HassDash appears in both header and footer)
    const hassDashElements = screen.getAllByText('HassDash');
    expect(hassDashElements.length).toBeGreaterThan(0);
    
    // Main content
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    
    // Footer elements
    expect(screen.getByText(/v0.1.0/)).toBeInTheDocument();
  });

  it('should render children in main content area', () => {
    const testId = 'test-content';
    render(
      <Layout>
        <div data-testid={testId}>Custom Content</div>
      </Layout>
    );

    const content = screen.getByTestId(testId);
    expect(content).toBeInTheDocument();
    expect(content).toHaveTextContent('Custom Content');
  });

  it('should use semantic HTML elements', () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const header = container.querySelector('header');
    const main = container.querySelector('main');
    const footer = container.querySelector('footer');

    expect(header).toBeInTheDocument();
    expect(main).toBeInTheDocument();
    expect(footer).toBeInTheDocument();
  });

  it('should have proper responsive classes', () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const maxWidthContainers = container.querySelectorAll('.max-w-7xl');
    expect(maxWidthContainers.length).toBeGreaterThan(0);

    const responsivePadding = container.querySelectorAll('[class*="sm:px"], [class*="lg:px"]');
    expect(responsivePadding.length).toBeGreaterThan(0);
  });

  it('should have flex layout with full height', () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const layoutRoot = container.firstChild as HTMLElement;
    expect(layoutRoot).toHaveClass('min-h-screen');
    expect(layoutRoot).toHaveClass('flex');
    expect(layoutRoot).toHaveClass('flex-col');
  });

  it('should have flexbox main content that grows', () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('flex-1');
  });
});
