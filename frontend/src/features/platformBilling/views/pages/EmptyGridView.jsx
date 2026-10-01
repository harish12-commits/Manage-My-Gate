import React from 'react'

const EmptyGridView = ({ title, sub }) => (
  <section className="page">
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
    </div>
    <div className="panel panel-body table-responsive">
      <table className="table">
        <tbody>
          <tr>
            <td colSpan="100%">No data</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
)

export default EmptyGridView
